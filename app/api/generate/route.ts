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

function normalizeText(value?: string) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function isFoodSubject(text: string) {
    const t = normalizeText(text);

    return (
        t.includes("burger") ||
        t.includes("hamburger") ||
        t.includes("sandwich") ||
        t.includes("hotdog") ||
        t.includes("pizza") ||
        t.includes("mancare") ||
        t.includes("food")
    );
}

function isMascotOrReplica(productType?: string, userPrompt?: string) {
    const t = normalizeText(`${productType || ""} ${userPrompt || ""}`);

    return (
        t.includes("mascota") ||
        t.includes("mascot") ||
        t.includes("replica") ||
        t.includes("produs")
    );
}

function shouldUseReferenceAsInitImage(options: {
    refImage?: string | null;
    generateMode: GenerateMode;
    respectReference: number;
    productType?: string;
    userPrompt?: string;
}) {
    const { refImage, generateMode, respectReference, productType, userPrompt } =
        options;

    if (!refImage) return false;

    const combined = `${productType || ""} ${userPrompt || ""}`;

    if (isFoodSubject(combined)) {
        return false;
    }

    if (isMascotOrReplica(productType, userPrompt) && respectReference < 90) {
        return false;
    }

    if (generateMode === "replica" && respectReference >= 90) {
        return true;
    }

    return false;
}

function getModePrompt(mode: GenerateMode, respectReference: number) {
    if (mode === "replica" || respectReference >= 85) {
        return `
STRICT CONTROLLED INFLATABLE MODE.
The result must be a commercial inflatable object, not a normal object.
Preserve the requested subject and reference logic, but convert everything into a manufacturable inflatable product.
Do not generate real food, real rigid products, toys, sculptures or ordinary 3D objects.
If the user asks for a burger, bottle, mascot or product, it must become an inflatable promotional object.
`.trim();
    }

    if (mode === "photo") {
        return `
CONTROLLED PHOTOREALISTIC MODE.
Create a realistic commercial visualization of the requested inflatable product.
The result must look like a real fabricated inflatable made from PVC panels.
Keep the design clean, stable, manufacturable and appropriate for client presentation.
`.trim();
    }

    return `
FAST CLEAN MOCKUP MODE.
Create a simple, clean commercial mockup of the requested inflatable product.
Use simplified inflatable geometry, smooth PVC volumes and few wrinkles.
`.trim();
}

function getProductTypePrompt(productType?: string, userPrompt?: string) {
    const base = normalizeText(`${productType || ""} ${userPrompt || ""}`);

    if (base.includes("burger") || base.includes("hamburger")) {
        return `
PRODUCT TYPE: INFLATABLE BURGER MASCOT / GIANT INFLATABLE BURGER REPLICA.

Mandatory rules:
- It must look like an inflatable promotional burger, not a real edible burger.
- Convert all burger layers into simplified inflated PVC shapes.
- Use smooth rounded PVC volumes.
- Use visible inflatable seam logic and welded panel construction.
- Avoid tiny realistic food details.
- Avoid wet meat texture, real sesame texture, real lettuce complexity and realistic edible food material.
- The burger may have simplified bun, cheese, lettuce and patty color zones, but all surfaces must look inflatable.
- The object must be large, light, air-filled and suitable for rooftop/event advertising.
- Use a stable inflatable construction, like a soft commercial advertising prop.
`.trim();
    }

    if (base.includes("arcad") || base.includes("arch")) {
        return `
PRODUCT TYPE: INFLATABLE ARCH.
Structure:
- two stable vertical inflated legs;
- one rounded inflated top bridge;
- clear commercial event arch silhouette;
- stable ground contact;
- realistic PVC tubes;
- no organic melting.
`.trim();
    }

    if (base.includes("mascot") || base.includes("mascota")) {
        return `
PRODUCT TYPE: INFLATABLE MASCOT / CHARACTER OBJECT.
Structure:
- simplified large inflatable character/object form;
- rounded air-filled volumes;
- stable base;
- readable silhouette;
- PVC seams only where useful;
- not a normal realistic object.
`.trim();
    }

    if (base.includes("cort") || base.includes("tent")) {
        return `
PRODUCT TYPE: INFLATABLE EVENT TENT.
Structure:
- inflatable tube frame;
- stable roof;
- fabricable proportions;
- no impossible thin elements.
`.trim();
    }

    if (base.includes("tunel")) {
        return `
PRODUCT TYPE: INFLATABLE TUNNEL.
Structure:
- long inflatable tunnel;
- rounded entrance;
- stable base;
- commercial sports/event appearance.
`.trim();
    }

    if (base.includes("sticl") || base.includes("bottle")) {
        return `
PRODUCT TYPE: INFLATABLE BOTTLE / PRODUCT REPLICA.
Structure:
- recognizable bottle silhouette;
- soft inflated body;
- simplified neck and cap;
- stable base;
- commercial promotional replica.
`.trim();
    }

    if (base.includes("cupol") || base.includes("dome")) {
        return `
PRODUCT TYPE: INFLATABLE DOME.
Structure:
- large rounded dome volume;
- stable base perimeter;
- clean PVC construction.
`.trim();
    }

    return `
PRODUCT TYPE: CUSTOM COMMERCIAL INFLATABLE OBJECT.
Structure:
- manufacturable inflatable form;
- stable proportions;
- rounded PVC volumes;
- believable welded-panel construction.
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
    usingRefAsInitImage: boolean;
}) {
    const {
        respectReference,
        respectShape,
        respectTexture,
        respectProportions,
        respectBranding,
        hasRefImage,
        hasTextureImage,
        usingRefAsInitImage,
    } = options;

    let prompt = `
Reference strength: ${respectReference}/100.
Reference image direct transformation: ${
        usingRefAsInitImage ? "enabled" : "disabled"
    }.
`.trim();

    if (hasRefImage) {
        prompt += `

A product reference image is provided.
Use it as visual guidance, but the output must always be an inflatable object.`;

        if (!usingRefAsInitImage) {
            prompt += `
The reference is NOT used as direct image-to-image input because the output must be re-built as an inflatable product, not copied as a normal object.`;
        }

        if (respectShape) {
            prompt += `
- Preserve the broad subject silhouette and recognizable object identity.`;
        }

        if (respectProportions) {
            prompt += `
- Preserve approximate proportions, but simplify for inflatable fabrication.`;
        }

        if (respectTexture) {
            prompt += `
- Preserve only the useful color/pattern logic. Convert textures into printable PVC graphics.`;
        }

        if (respectBranding) {
            prompt += `
- Preserve branding placement only if clearly visible and relevant. Do not invent random text or logos.`;
        }
    } else {
        prompt += `

No product reference image was provided. Generate from the written request and selected type.`;
    }

    if (hasTextureImage) {
        prompt += `

A separate texture/branding image is provided.
Apply its color or print logic as a PVC surface print.
Do not let the texture destroy the inflatable form.`;
    }

    return prompt.trim();
}

function getMaterialPrompt(material: string) {
    if (material === "PVC lucios") {
        return `
Material: glossy inflatable PVC.
Surface: clean smooth PVC, soft rounded highlights, visible inflated volume, controlled reflections.
Avoid hard plastic, metal, real food, natural skin, stone or rigid materials.
`.trim();
    }

    if (material === "PVC mat") {
        return `
Material: matte inflatable PVC.
Surface: soft diffuse reflections, professional PVC/fabric appearance, welded seams.
Avoid glossy hard plastic.
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
Lighting target: NIGHT.
The inflatable object must be compatible with a night scene.
Use darker exposure, stronger highlights, possible glow if material allows.
Do not use bright daylight lighting.
Do not create sunny shadows.
`.trim();
    }

    if (lighting === "Golden hour") {
        return `
Lighting target: GOLDEN HOUR.
Use warm sunlight, amber highlights, soft long shadows and warm commercial photography mood.
`.trim();
    }

    if (lighting === "Interior") {
        return `
Lighting target: INTERIOR.
Use controlled indoor soft lighting and subdued reflections.
`.trim();
    }

    return `
Lighting target: DAYLIGHT.
Use natural outdoor daylight, clean highlights and soft realistic shadows.
Do not create night lighting or neon glow.
`.trim();
}

function getRealismPrompt(realism: number) {
    if (realism <= 30) {
        return `
Inflatable detail level: CLEAN.
Very smooth shape.
Minimal wrinkles.
Minimal seams.
Simple polished mockup.
No deep folds.
No bumpy geometry.
`.trim();
    }

    if (realism <= 60) {
        return `
Inflatable detail level: BALANCED.
Clean commercial inflatable with moderate welded seams and mild PVC tension.
Keep the object pressurized, smooth and stable.
Do not add excessive folds.
`.trim();
    }

    if (realism <= 80) {
        return `
Inflatable detail level: REALISTIC.
Visible welded seams, realistic PVC tension and soft rounded inflated edges.
Moderate fabric behavior.
No chaotic wrinkles.
`.trim();
    }

    return `
Inflatable detail level: VERY REALISTIC.
More seam detail and material tension, but still clean, pressurized and professional.
Avoid deflated fabric, melted shapes and excessive folds.
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

Interpretation:
- These dimensions describe the final inflatable object.
- Respect the width/height/depth ratio visually.
- If width and height are similar, generate a compact object.
- If height is larger than width, generate a vertical object.
- If width is larger than height, generate a horizontal object.
- Auto-scale from scene is ${autoScale ? "enabled" : "disabled"}.

Important:
The preview placement and overlay scale will be controlled in the frontend.
Do not make scale decisions based on background buildings.
`.trim();
}

function getNegativePrompt(options: {
    mode: GenerateMode;
    respectReference: number;
    realism: number;
    lighting: string;
    userPrompt: string;
    productType: string;
}) {
    const { mode, respectReference, realism, lighting, userPrompt, productType } =
        options;

    let negative = `
normal non-inflatable object,
real food,
real edible burger,
photorealistic food photography,
wet food texture,
real meat texture,
real lettuce texture,
real sesame texture,
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

    if (isFoodSubject(`${userPrompt} ${productType}`)) {
        negative += `,
real burger,
real hamburger,
edible burger,
food photo,
restaurant food,
hyperrealistic food,
food ingredients as real materials`;
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
  "manufacturing_notes": "short notes about how it could be simplified into inflatable PVC panels"
}

Important:
- If the reference is a normal real object, describe how it could become an inflatable replica.
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

        const usingRefAsInitImage = shouldUseReferenceAsInitImage({
            refImage,
            generateMode,
            respectReference,
            productType,
            userPrompt,
        });

        const geminiAnalysis = refImage
            ? await analyzeReferenceWithGemini(refImage, googleKey)
            : null;

        const modePrompt = getModePrompt(generateMode, respectReference);
        const productTypePrompt = getProductTypePrompt(productType, userPrompt);

        const referencePrompt = getReferencePrompt({
            respectReference,
            respectShape,
            respectTexture,
            respectProportions,
            respectBranding,
            hasRefImage: Boolean(refImage),
            hasTextureImage: Boolean(textureImage),
            usingRefAsInitImage,
        });

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
This is only compositing intent.
Generate a clean transparent object; frontend controls exact placement and size.
`
            : "";

        const finalPrompt = `
Create a transparent PNG overlay of a commercial inflatable advertising product.

User short request:
${userPrompt}

Expanded request:
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

Absolute output rules:
- Generate ONLY the inflatable object.
- Transparent background.
- No environment.
- No people.
- No cars.
- No trees.
- No buildings.
- The object must be complete and not cropped.
- The result must look air-filled, soft, pressurized and made from PVC.
- If the subject is food, it must be an inflatable promotional replica of food, not real food.
- Use simplified printable color zones instead of real edible texture.
- Keep the design clean enough for commercial client presentation.
`.trim();

        const negativePrompt = getNegativePrompt({
            mode: generateMode,
            respectReference,
            realism: realismValue,
            lighting,
            userPrompt,
            productType,
        });

        const formData = new FormData();
        formData.append("prompt", finalPrompt);
        formData.append("negative_prompt", negativePrompt);
        formData.append("output_format", "png");

        if (usingRefAsInitImage && refImage) {
            const refBlob = base64ToBlob(refImage, "image/jpeg");
            formData.append("image", refBlob, "reference.jpg");
            formData.append("mode", "image-to-image");

            const strength =
                respectReference >= 95
                    ? "0.30"
                    : respectReference >= 90
                      ? "0.36"
                      : "0.44";

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
                usingRefAsInitImage,
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
