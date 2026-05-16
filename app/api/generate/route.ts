import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60;

type GenerateMode = "rapid" | "photo" | "replica";

type RequestBody = {
    sceneImage?: string;
    refImage?: string | null;
    textureImage?: string | null;
    prompt?: string;
    userPrompt?: string;
    productPreset?: string;
    productType?: string;
    generateMode?: GenerateMode;
    referenceControl?: {
        respectReference?: number;
        respectShape?: boolean;
        respectTexture?: boolean;
        respectProportions?: boolean;
        respectBranding?: boolean;
    };
    dimensions?: {
        widthM?: number;
        heightM?: number;
        depthM?: number;
        autoScale?: boolean;
    };
    material?: string;
    lighting?: string;
    realism?: number;
    placement?: {
        x?: number;
        y?: number;
    };
};

function base64ToBlob(base64: string, type = "image/jpeg") {
    const buffer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return new Blob([buffer], { type });
}

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function getModePrompt(mode: GenerateMode, respectReference: number) {
    if (mode === "replica" || respectReference >= 85) {
        return `
STRICT CONTROLLED REPLICA MODE.
The product reference image is the main source of truth.
Preserve the same object category, same inflatable structure, same silhouette logic and same major proportions.
Do not creatively redesign the object into a different product.
Do not replace the requested object with a random generic object.
If the user wrote a subject such as "burger", generate that subject as an inflatable object, not as a normal real burger.
`.trim();
    }

    if (mode === "photo") {
        return `
CONTROLLED PHOTOREALISTIC MODE.
Create a realistic commercial visualization of the requested inflatable product.
Keep the object manufacturable, correctly scaled and appropriate for the selected environment.
Avoid over-designing or adding unnecessary details.
`.trim();
    }

    return `
FAST CLEAN MOCKUP MODE.
Create a simple, clean, commercial mockup of the requested inflatable product.
Use simplified geometry and fewer wrinkles.
Avoid excessive folds and chaotic details.
`.trim();
}

function getReferencePrompt(options: {
    respectReference: number;
    respectShape: boolean;
    respectTexture: boolean;
    respectProportions: boolean;
    respectBranding: boolean;
    hasRefImage: boolean;
    hasTextureImage: boolean;
}) {
    const {
        respectReference,
        respectShape,
        respectTexture,
        respectProportions,
        respectBranding,
        hasRefImage,
        hasTextureImage,
    } = options;

    let prompt = `
Reference strength: ${respectReference}/100.
`.trim();

    if (hasRefImage) {
        prompt += `

A product reference image is provided. Use it only as a design reference for the inflatable product.`;

        if (respectShape) {
            prompt += `
- Preserve the reference object's overall shape category, silhouette logic and inflatable construction language.`;
        }

        if (respectProportions) {
            prompt += `
- Preserve approximate proportions, but adjust them only if required to make the object fabricable and stable as an inflatable.`;
        }

        if (respectTexture) {
            prompt += `
- Preserve the visible color arrangement, printed graphics, pattern logic and surface layout from the reference if applicable.`;
        }

        if (respectBranding) {
            prompt += `
- Preserve branding placement only when it is clearly visible and requested. Do not invent random logos or text.`;
        }

        if (respectReference >= 85) {
            prompt += `
- Do not convert the reference into a different object.
- Do not ignore the reference.
- Do not generate a normal non-inflatable object.
- The final result must remain a commercial inflatable product.`;
        }
    } else {
        prompt += `

No product reference image was provided. Generate strictly from the written request and selected product type.`;
    }

    if (hasTextureImage) {
        prompt += `

A separate texture/branding image is provided.
Use it as surface inspiration only.
Apply its colors or texture logic onto the inflatable surface.
Keep the inflatable product form stable and manufacturable.`;
    }

    return prompt.trim();
}

function getProductTypePrompt(productType?: string, userPrompt?: string) {
    const base = `${productType || ""} ${userPrompt || ""}`.toLowerCase();

    if (base.includes("arcad")) {
        return `
Product type: inflatable arch.
Structure requirements:
- two stable vertical legs;
- one rounded top bridge;
- commercial event arch proportions;
- stable on ground;
- no excessive organic deformation.
`.trim();
    }

    if (base.includes("mascot") || base.includes("mascotă")) {
        return `
Product type: inflatable mascot / inflatable character object.
Structure requirements:
- simplified large inflatable shape;
- rounded volumes;
- stable base;
- visible inflatable seams only where useful;
- not a normal realistic object, but an inflatable interpretation of the subject.
`.trim();
    }

    if (base.includes("burger")) {
        return `
Product type: inflatable burger mascot / inflatable product replica.
Structure requirements:
- the subject is a burger, but it must be clearly made as an inflatable object;
- simplified rounded burger layers;
- smooth PVC surface;
- fewer tiny food details;
- no realistic food texture overload;
- stable commercial inflatable form;
- large event prop appearance.
`.trim();
    }

    if (base.includes("cort") || base.includes("tent")) {
        return `
Product type: inflatable event tent.
Structure requirements:
- inflatable tube frame;
- stable roof;
- fabricable event tent proportions;
- no impossible thin elements.
`.trim();
    }

    if (base.includes("tunel")) {
        return `
Product type: inflatable tunnel.
Structure requirements:
- long inflatable tunnel;
- rounded entrance;
- stable base;
- commercial sports event appearance.
`.trim();
    }

    if (base.includes("sticl")) {
        return `
Product type: inflatable bottle / product replica.
Structure requirements:
- recognizable bottle silhouette;
- soft inflated body;
- simplified neck and cap;
- stable base;
- commercial product replica.
`.trim();
    }

    if (base.includes("cupol")) {
        return `
Product type: inflatable dome.
Structure requirements:
- large rounded dome volume;
- stable base perimeter;
- clean PVC construction.
`.trim();
    }

    return `
Product type: custom commercial inflatable object.
Structure requirements:
- manufacturable inflatable form;
- stable proportions;
- rounded PVC volumes;
- believable welded-panel construction.
`.trim();
}

function getMaterialPrompt(material: string) {
    if (material === "PVC lucios") {
        return `
Material: glossy inflatable PVC.
Surface: clean, smooth, controlled highlights, slight seam reflections.
Do not make it look like hard plastic or metal.
`.trim();
    }

    if (material === "PVC mat") {
        return `
Material: matte inflatable PVC.
Surface: soft diffuse reflections, professional outdoor fabric/PVC appearance.
Do not make it glossy.
`.trim();
    }

    if (material === "Alb translucid") {
        return `
Material: white translucent inflatable PVC.
Surface: soft light diffusion, semi-translucent white material, subtle internal scattering.
`.trim();
    }

    if (material === "LED interior") {
        return `
Material: translucent internally illuminated inflatable PVC.
Surface: soft glow through the material, visible internal light diffusion, premium LED inflatable look.
`.trim();
    }

    if (material === "Outdoor heavy-duty") {
        return `
Material: heavy-duty outdoor inflatable PVC.
Surface: reinforced seams, durable commercial PVC fabric, robust event-grade construction.
`.trim();
    }

    return `
Material: realistic commercial inflatable PVC.
`.trim();
}

function getLightingPrompt(lighting: string) {
    if (lighting === "Noapte") {
        return `
Lighting and environment target: NIGHT.
The object lighting must be compatible with a dark scene.
Use stronger highlights, controlled glow if material allows it, and darker overall lighting.
Do not generate daylight shadows.
Do not make it look like daytime.
`.trim();
    }

    if (lighting === "Golden hour") {
        return `
Lighting and environment target: GOLDEN HOUR.
Use warm sunlight, soft long shadows, amber highlights, commercial outdoor photography mood.
Do not use cold studio lighting.
`.trim();
    }

    if (lighting === "Interior") {
        return `
Lighting and environment target: INTERIOR.
Use soft indoor lighting, controlled reflections and realistic indoor shadow behavior.
`.trim();
    }

    return `
Lighting and environment target: DAYLIGHT.
Use natural outdoor daylight, clean highlights, soft realistic shadows.
Do not generate night lighting.
`.trim();
}

function getRealismPrompt(realism: number) {
    if (realism <= 30) {
        return `
Inflatable detail level: CLEAN.
Very smooth shape.
Minimal wrinkles.
Minimal seams.
Simple commercial mockup.
Avoid complex folds and bumpy geometry.
`.trim();
    }

    if (realism <= 60) {
        return `
Inflatable detail level: BALANCED.
Clean commercial inflatable with moderate welded seams, mild tension lines and controlled PVC wrinkles.
Do not add excessive folds.
Do not make the object look damaged or deflated.
`.trim();
    }

    if (realism <= 80) {
        return `
Inflatable detail level: REALISTIC.
Visible welded seams, realistic PVC tension, soft rounded inflated edges, moderate physical fabric behavior.
Keep geometry stable and clean.
`.trim();
    }

    return `
Inflatable detail level: VERY REALISTIC.
More seam detail and material tension, but still clean, pressurized and professional.
Avoid chaotic folds, deflation, melted shapes or excessive wrinkles.
`.trim();
}

function getDimensionsPrompt(dimensions: RequestBody["dimensions"]) {
    const widthM = clamp(Number(dimensions?.widthM ?? 3), 0.5, 20);
    const heightM = clamp(Number(dimensions?.heightM ?? 3), 0.5, 20);
    const depthM = clamp(Number(dimensions?.depthM ?? 1.2), 0.2, 10);
    const autoScale = dimensions?.autoScale ?? false;

    return `
Physical target size:
Width: ${widthM.toFixed(1)} meters.
Height: ${heightM.toFixed(1)} meters.
Depth: ${depthM.toFixed(1)} meters.

Important:
- These dimensions describe the generated inflatable object itself.
- Respect the width/height/depth ratio.
- Do not make the object absurdly huge unless dimensions say so.
- Do not make the object tiny unless dimensions say so.
- Auto-scale from scene is ${autoScale ? "enabled" : "disabled"}.
`.trim();
}

function getNegativePrompt(options: {
    mode: GenerateMode;
    respectReference: number;
    realism: number;
    lighting: string;
}) {
    const { mode, respectReference, realism, lighting } = options;

    let negative = `
normal non-inflatable object,
real food,
real burger,
real rigid product,
hard sculpture,
metal,
stone,
wood,
paper,
cardboard,
deflated bag,
melted geometry,
chaotic folds,
excessive wrinkles,
bumpy damaged surface,
floating object,
cropped object,
cut off object,
bad transparent edges,
extra background,
white background,
black background,
street background,
building background,
people,
cars,
trees,
random props,
watermark,
random text,
misspelled text,
logo artifacts,
low resolution,
blurry,
distorted perspective,
wrong scale
`.trim();

    if (mode === "replica" || respectReference >= 85) {
        negative += `,
creative redesign,
different silhouette,
unrelated object,
generic replacement,
ignoring reference`;
    }

    if (realism <= 60) {
        negative += `,
too many wrinkles,
deep folds,
damaged fabric,
dirty surface,
overcomplicated geometry`;
    }

    if (lighting === "Noapte") {
        negative += `,
daylight scene,
sunny daylight shadows`;
    } else if (lighting === "Zi") {
        negative += `,
night scene,
dark night lighting,
strong neon glow`;
    }

    return negative;
}

async function analyzeReferenceWithGemini(refImage: string, googleKey?: string) {
    if (!googleKey || !refImage) {
        return null;
    }

    try {
        const genAI = new GoogleGenerativeAI(googleKey);

        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: {
                temperature: 0.1,
                responseMimeType: "application/json",
            },
        });

        const result = await model.generateContent([
            {
                inlineData: {
                    data: refImage,
                    mimeType: "image/jpeg",
                },
            },
            `
Analyze the provided image as a reference for a commercial inflatable product.

Return strict JSON only:
{
  "object_type": "short English object type",
  "shape_description": "short exact geometry/silhouette description",
  "texture_description": "short description of colors, surface pattern and graphics",
  "proportions": "short proportions description",
  "manufacturing_notes": "short notes about seams, inflatable tubes and panels"
}

Important:
- If the reference is a normal object, describe how it could become an inflatable replica.
- Do not describe the background.
- No markdown.
`,
        ]);

        const text = result.response
            .text()
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        return JSON.parse(text);
    } catch (error) {
        console.warn("Gemini reference analysis failed:", error);
        return null;
    }
}

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as RequestBody;

        const {
            sceneImage,
            refImage,
            textureImage,
            prompt = "professional commercial inflatable object",
            userPrompt = "",
            productPreset = "",
            productType = "Custom",
            generateMode = "photo",
            referenceControl,
            dimensions,
            material = "PVC lucios",
            lighting = "Zi",
            realism = 55,
            placement,
        } = body;

        const stabilityKey = process.env.STABILITY_API_KEY;
        const googleKey = process.env.GOOGLE_GENAI_API_KEY;

        if (!stabilityKey) {
            return NextResponse.json(
                { error: "Lipsește STABILITY_API_KEY în Vercel." },
                { status: 400 }
            );
        }

        if (!sceneImage) {
            return NextResponse.json(
                { error: "Lipsește imaginea de scenă." },
                { status: 400 }
            );
        }

        const respectReference = clamp(
            Number(referenceControl?.respectReference ?? 65),
            0,
            100
        );

        const respectShape = referenceControl?.respectShape ?? true;
        const respectTexture = referenceControl?.respectTexture ?? true;
        const respectProportions = referenceControl?.respectProportions ?? true;
        const respectBranding = referenceControl?.respectBranding ?? true;

        const realismValue = clamp(Number(realism), 0, 100);

        const geminiAnalysis = refImage
            ? await analyzeReferenceWithGemini(refImage, googleKey)
            : null;

        const modePrompt = getModePrompt(generateMode, respectReference);

        const referencePrompt = getReferencePrompt({
            respectReference,
            respectShape,
            respectTexture,
            respectProportions,
            respectBranding,
            hasRefImage: Boolean(refImage),
            hasTextureImage: Boolean(textureImage),
        });

        const productTypePrompt = getProductTypePrompt(productType, userPrompt);
        const materialPrompt = getMaterialPrompt(material);
        const lightingPrompt = getLightingPrompt(lighting);
        const realismPrompt = getRealismPrompt(realismValue);
        const dimensionsPrompt = getDimensionsPrompt(dimensions);

        const geminiPrompt = geminiAnalysis
            ? `
Reference image analysis:
Object type: ${geminiAnalysis.object_type}
Shape: ${geminiAnalysis.shape_description}
Texture / print: ${geminiAnalysis.texture_description}
Proportions: ${geminiAnalysis.proportions}
Manufacturing notes: ${geminiAnalysis.manufacturing_notes}
`
            : "";

        const placementPrompt = placement
            ? `
User selected placement on preview:
X: ${Number(placement.x ?? 50).toFixed(1)}%.
Y: ${Number(placement.y ?? 70).toFixed(1)}%.
This is used only as compositing intent; generate object as clean transparent overlay.
`
            : "";

        const finalPrompt = `
Create a transparent PNG overlay of a commercial inflatable product.

User short request:
${userPrompt}

Expanded product request:
${prompt}

Selected product preset:
${productPreset}

${productTypePrompt}

${modePrompt}

${referencePrompt}

${geminiPrompt}

${dimensionsPrompt}

${materialPrompt}

${lightingPrompt}

${realismPrompt}

${placementPrompt}

Critical output rules:
- Generate ONLY the inflatable object.
- Transparent background.
- No environment.
- No people.
- No cars.
- No trees.
- No buildings.
- The object must be complete and not cropped.
- The object must be fabricable as a real inflatable.
- The object must have a stable base or plausible suspension depending on the subject.
- If the subject is a burger, bottle, mascot or product replica, it must be an inflatable version of that subject, not the real object.
- Keep the design clean enough for commercial client presentation.
`.trim();

        const negativePrompt = getNegativePrompt({
            mode: generateMode,
            respectReference,
            realism: realismValue,
            lighting,
        });

        const formData = new FormData();
        formData.append("prompt", finalPrompt);
        formData.append("negative_prompt", negativePrompt);
        formData.append("output_format", "png");

        if (refImage) {
            const refBlob = base64ToBlob(refImage, "image/jpeg");
            formData.append("image", refBlob, "reference.jpg");
            formData.append("mode", "image-to-image");

            const strength =
                respectReference >= 90
                    ? "0.32"
                    : respectReference >= 75
                      ? "0.44"
                      : respectReference >= 55
                        ? "0.58"
                        : "0.72";

            formData.append("strength", strength);
        } else {
            formData.append("aspect_ratio", "1:1");
        }

        const generateResponse = await fetch(
            "https://api.stability.ai/v2beta/stable-image/generate/core",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${stabilityKey}`,
                    Accept: "application/json",
                },
                body: formData,
            }
        );

        if (!generateResponse.ok) {
            const errorText = await generateResponse.text();

            return NextResponse.json(
                {
                    error: `Eroare Stability Generate: ${errorText}`,
                    prompt: finalPrompt,
                    negativePrompt,
                },
                { status: 400 }
            );
        }

        const generatedData = await generateResponse.json();

        if (!generatedData.image) {
            return NextResponse.json(
                {
                    error: "Stability nu a returnat nicio imagine.",
                    raw: generatedData,
                },
                { status: 500 }
            );
        }

        const generatedBlob = base64ToBlob(generatedData.image, "image/png");

        const bgFormData = new FormData();
        bgFormData.append("image", generatedBlob, "generated.png");
        bgFormData.append("output_format", "png");

        const bgResponse = await fetch(
            "https://api.stability.ai/v2beta/stable-image/edit/remove-background",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${stabilityKey}`,
                    Accept: "application/json",
                },
                body: bgFormData,
            }
        );

        if (!bgResponse.ok) {
            const errorText = await bgResponse.text();

            return NextResponse.json({
                overlayUrl: `data:image/png;base64,${generatedData.image}`,
                warning: `Remove background failed: ${errorText}`,
                prompt: finalPrompt,
                negativePrompt,
            });
        }

        const bgData = await bgResponse.json();
        const finalImageBase64 = bgData.image || bgData.base64;

        if (!finalImageBase64) {
            return NextResponse.json({
                overlayUrl: `data:image/png;base64,${generatedData.image}`,
                warning:
                    "Remove background nu a returnat imagine; se folosește imaginea generată inițial.",
                prompt: finalPrompt,
                negativePrompt,
            });
        }

        return NextResponse.json({
            overlayUrl: `data:image/png;base64,${finalImageBase64}`,
            prompt: finalPrompt,
            negativePrompt,
            debug: {
                userPrompt,
                productPreset,
                productType,
                generateMode,
                respectReference,
                respectShape,
                respectTexture,
                respectProportions,
                respectBranding,
                material,
                lighting,
                realism: realismValue,
                dimensions,
                placement,
                geminiAnalysis,
            },
        });
    } catch (error: any) {
        console.error("Generate route error:", error);

        return NextResponse.json(
            {
                error: error.message || "Eroare internă server.",
            },
            { status: 500 }
        );
    }
}
