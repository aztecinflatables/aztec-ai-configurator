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
    shapeDetail?: number;
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

function shouldUseReferenceAsInitImage(options: {
    refImage?: string | null;
    generateMode: GenerateMode;
    respectReference: number;
    productType?: string;
    userPrompt?: string;
    shapeDetail: number;
}) {
    const {
        refImage,
        generateMode,
        respectReference,
        productType,
        userPrompt,
        shapeDetail,
    } = options;

    if (!refImage) return false;

    const combined = `${productType || ""} ${userPrompt || ""}`;

    if (isFoodSubject(combined) && respectReference < 94) {
        return false;
    }

    if (shapeDetail < 45) {
        return false;
    }

    if (generateMode === "replica" && respectReference >= 86) {
        return true;
    }

    if (respectReference >= 92 && shapeDetail >= 65) {
        return true;
    }

    return false;
}

function getProductTypePrompt(productType?: string, userPrompt?: string) {
    const base = normalizeText(`${productType || ""} ${userPrompt || ""}`);

    if (base.includes("burger") || base.includes("hamburger")) {
        return `
PRODUCT TYPE: GIANT INFLATABLE BURGER PROMOTIONAL REPLICA.

Mandatory geometry:
- the subject is a burger, but it must be clearly an inflatable advertising object;
- simplified rounded bun volumes;
- simplified inflated cheese / lettuce / patty layers;
- soft PVC surfaces;
- all details must be converted into air-filled inflatable forms or printed PVC graphics;
- no real edible food material;
- no wet food texture;
- no realistic restaurant-food look;
- stable giant promotional inflatable, suitable for rooftop or event placement.
`.trim();
    }

    if (base.includes("arcad") || base.includes("arch")) {
        return `
PRODUCT TYPE: INFLATABLE ARCH.

Mandatory geometry:
- two vertical inflated legs;
- one rounded inflated top bridge;
- clear commercial event arch silhouette;
- stable base;
- realistic PVC tube construction.
`.trim();
    }

    if (base.includes("mascot") || base.includes("mascota")) {
        return `
PRODUCT TYPE: INFLATABLE MASCOT / CHARACTER OBJECT.

Mandatory geometry:
- simplified readable mascot silhouette;
- large rounded air-filled forms;
- stable base;
- PVC seams only where useful;
- not a normal realistic rigid object.
`.trim();
    }

    if (base.includes("cort") || base.includes("tent")) {
        return `
PRODUCT TYPE: INFLATABLE EVENT TENT.

Mandatory geometry:
- inflated tube frame;
- stable roof;
- fabricable commercial tent proportions;
- no impossible thin elements.
`.trim();
    }

    if (base.includes("tunel")) {
        return `
PRODUCT TYPE: INFLATABLE TUNNEL.

Mandatory geometry:
- long inflated tunnel body;
- rounded entry;
- stable base;
- commercial event appearance.
`.trim();
    }

    if (base.includes("sticl") || base.includes("bottle")) {
        return `
PRODUCT TYPE: INFLATABLE BOTTLE / PRODUCT REPLICA.

Mandatory geometry:
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

Mandatory geometry:
- rounded dome volume;
- stable base perimeter;
- clean PVC construction.
`.trim();
    }

    return `
PRODUCT TYPE: CUSTOM COMMERCIAL INFLATABLE OBJECT.

Mandatory geometry:
- manufacturable inflatable form;
- rounded PVC volumes;
- stable proportions;
- believable welded-panel construction.
`.trim();
}

function getModePrompt(mode: GenerateMode, respectReference: number) {
    if (mode === "replica" || respectReference >= 86) {
        return `
GENERATION MODE: CONTROLLED INFLATABLE REPLICA.

Rules:
- preserve the requested subject;
- preserve reference shape when a reference is provided;
- convert the result into a real commercial inflatable object;
- do not generate ordinary real objects;
- do not generate scenery;
- do not modify or include the uploaded background photo.
`.trim();
    }

    if (mode === "photo") {
        return `
GENERATION MODE: PHOTOREALISTIC INFLATABLE PRODUCT.

Rules:
- clean commercial visualization;
- realistic PVC material;
- manufacturable shape;
- controlled level of form detail;
- no scenery or background.
`.trim();
    }

    return `
GENERATION MODE: CLEAN MOCKUP.

Rules:
- simple geometry;
- very readable silhouette;
- minimal surface detail;
- commercial mockup style;
- no scenery or background.
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
    shapeDetail: number;
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
        shapeDetail,
    } = options;

    let prompt = `
REFERENCE CONTROL:
Reference strength: ${respectReference}/100.
Reference direct image-to-image: ${usingRefAsInitImage ? "ON" : "OFF"}.
Shape detail level: ${shapeDetail}/100.
`.trim();

    if (hasRefImage) {
        prompt += `

A product reference image was uploaded.
Use it as product design reference only.`;

        if (respectShape) {
            prompt += `
- preserve the recognizable shape and silhouette logic from the reference;`;
        }

        if (respectProportions) {
            prompt += `
- preserve approximate proportions from the reference;`;
        }

        if (respectTexture) {
            prompt += `
- preserve useful color / texture / pattern logic as printable PVC graphics;`;
        }

        if (respectBranding) {
            prompt += `
- preserve branding placement only if clearly visible; do not invent random text;`;
        }

        if (shapeDetail <= 25) {
            prompt += `
- simplify the reference aggressively into large primitive inflatable volumes;
- keep only the main silhouette and major color zones;`;
        } else if (shapeDetail <= 50) {
            prompt += `
- simplify the reference into clean inflatable volumes;
- preserve main recognizable forms but remove small details;`;
        } else if (shapeDetail <= 80) {
            prompt += `
- preserve most of the reference form while converting details into PVC panels and printed graphics;`;
        } else {
            prompt += `
- preserve the reference form closely, but still make it fabricable as a real inflatable object;`;
        }

        prompt += `
- always convert the result into a commercial inflatable product.`;
    } else {
        prompt += `

No product reference image was uploaded.
Generate from the written request and product type.`;
    }

    if (hasTextureImage) {
        prompt += `

A separate texture/branding image was uploaded.
Use it as surface print inspiration only.
Do not let the texture destroy the inflatable shape.`;
    }

    return prompt.trim();
}

function getMaterialPrompt(material: string) {
    if (material === "PVC lucios") {
        return `
MATERIAL:
Glossy inflatable PVC.
Smooth air-filled surface, soft specular highlights, welded seams, flexible pressurized material.
`.trim();
    }

    if (material === "PVC mat") {
        return `
MATERIAL:
Matte inflatable PVC.
Soft diffuse reflections, clean professional PVC fabric look, welded seams.
`.trim();
    }

    if (material === "Alb translucid") {
        return `
MATERIAL:
White translucent inflatable PVC.
Soft internal scattering, milky semi-translucent air-filled surface.
`.trim();
    }

    if (material === "LED interior") {
        return `
MATERIAL:
Translucent internally illuminated inflatable PVC.
Soft internal LED glow through the material.
`.trim();
    }

    if (material === "Outdoor heavy-duty") {
        return `
MATERIAL:
Heavy-duty outdoor inflatable PVC.
Reinforced seams, robust event-grade construction, durable fabric texture.
`.trim();
    }

    return `
MATERIAL:
Realistic commercial inflatable PVC.
`.trim();
}

function getLightingPrompt(lighting: string) {
    if (lighting === "Noapte") {
        return `
LIGHTING:
Night-compatible object lighting.
Dark-scene compatible shading.
Controlled specular highlights.
If the material is translucent or LED interior, add soft internal glow.
Do not use daylight shadows.
Do not create a sunny look.
The object should visually fit a nighttime placement.
`.trim();
    }

    if (lighting === "Golden hour") {
        return `
LIGHTING:
Warm golden-hour object lighting.
Amber highlights.
Soft warm directional light.
Subtle long-shadow direction.
Commercial outdoor evening mood.
`.trim();
    }

    if (lighting === "Interior") {
        return `
LIGHTING:
Interior-compatible object lighting.
Soft controlled indoor reflections.
Subdued shadows.
No outdoor sunlight.
`.trim();
    }

    return `
LIGHTING:
Daylight-compatible object lighting.
Natural outdoor daylight.
Clean neutral exposure.
Soft realistic object shading.
No night glow.
No dark night exposure.
`.trim();
}

function getShapeDetailPrompt(shapeDetail: number) {
    if (shapeDetail <= 20) {
        return `
FORM COMPLEXITY:
Very simple inflatable form.
Build from large primitive inflated shapes only.
Clear readable silhouette.
No small geometry.
No complex topology.
No decorative micro-details.
The object should look like a clean classic inflatable made from a few big PVC volumes.

WRINKLES / PVC FEEL:
Always keep only subtle PVC tension marks.
Do not increase wrinkles because of this slider.
`.trim();
    }

    if (shapeDetail <= 45) {
        return `
FORM COMPLEXITY:
Simple commercial inflatable form.
Use large rounded inflated volumes.
Preserve the subject identity, but simplify secondary details.
Small details should become printed graphics or simplified soft PVC forms.

WRINKLES / PVC FEEL:
Only subtle tension wrinkles near seams and edges.
No deep folds.
`.trim();
    }

    if (shapeDetail <= 70) {
        return `
FORM COMPLEXITY:
Balanced inflatable form.
Preserve recognizable subject proportions and medium-size details.
Convert complex details into fabricable PVC panel logic.
Keep the shape clean and stable.

WRINKLES / PVC FEEL:
Subtle PVC tension, mild seam definition, no excessive fabric folding.
`.trim();
    }

    if (shapeDetail <= 90) {
        return `
FORM COMPLEXITY:
Detailed inflatable form.
Preserve most important silhouette details and reference features.
Use welded PVC panel logic for detail.
Keep fabricability and stable air-filled construction.

WRINKLES / PVC FEEL:
Controlled subtle PVC tension only.
Do not create damaged or deflated wrinkles.
`.trim();
    }

    return `
FORM COMPLEXITY:
Very detailed inflatable replica.
Preserve the reference shape closely where possible.
Keep the object manufacturable as PVC inflatable panels.
Complex details should still be simplified into inflatable construction or printed surface graphics.

WRINKLES / PVC FEEL:
Subtle PVC tension marks only.
No chaotic folds.
No deflated fabric.
`.trim();
}

function getDimensionsPrompt(dimensions: RequestBody["dimensions"]) {
    const widthM = clamp(Number(dimensions?.widthM ?? 3), 0.5, 20);
    const heightM = clamp(Number(dimensions?.heightM ?? 3), 0.5, 20);
    const depthM = clamp(Number(dimensions?.depthM ?? 1.2), 0.2, 10);

    return `
REAL DIMENSIONS:
Height: ${heightM.toFixed(1)} meters.
Width: ${widthM.toFixed(1)} meters.
Length / depth: ${depthM.toFixed(1)} meters.

Rules:
- Respect the height / width / length ratio in the generated object.
- These are product dimensions, not background dimensions.
- Frontend handles final placement and scale over the photo.
`.trim();
}

function getNegativePrompt(options: {
    generateMode: GenerateMode;
    respectReference: number;
    shapeDetail: number;
    lighting: string;
    userPrompt: string;
    productType: string;
}) {
    const {
        generateMode,
        respectReference,
        shapeDetail,
        lighting,
        userPrompt,
        productType,
    } = options;

    let negative = `
background,
building,
street,
sky,
ground,
people,
cars,
trees,
environment,
photo background,
changed background,
modified background photo,
normal real object,
real food,
real edible burger,
food photography,
wet food texture,
real meat texture,
real lettuce texture,
real sesame detail,
hard sculpture,
rigid plastic,
metal,
stone,
wood,
paper,
cardboard,
cropped object,
cut off object,
bad transparent edges,
low resolution,
blurry,
distorted perspective,
wrong scale,
watermark,
random text,
misspelled text,
logo artifacts,
deflated fabric,
damaged fabric,
dirty PVC,
chaotic folds,
excessive wrinkles,
deep folds
`.trim();

    if (shapeDetail <= 45) {
        negative += `,
many small details,
complex noisy surface,
overdetailed geometry,
high frequency detail,
tiny parts,
complex topology`;
    }

    if (lighting === "Noapte") {
        negative += `,
daylight,
sunny shadows,
bright noon lighting`;
    }

    if (lighting === "Zi") {
        negative += `,
night lighting,
dark night exposure,
neon glow`;
    }

    if (isFoodSubject(`${userPrompt} ${productType}`)) {
        negative += `,
ordinary burger,
real hamburger,
restaurant food,
edible food,
hyperrealistic food photo`;
    }

    if (generateMode === "replica" || respectReference >= 88) {
        negative += `,
unrelated object,
ignoring requested subject`;
    }

    return negative;
}

async function analyzeReferenceWithGemini(refImage: string, googleKey?: string) {
    if (!googleKey || !refImage) return null;

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
Analyze this image as a product reference for an inflatable replica.

Return strict JSON only:
{
  "object_type": "short English object type",
  "shape_description": "short shape description",
  "texture_description": "short texture / color / print description",
  "proportions": "short proportions description",
  "inflatable_conversion": "how to simplify it into inflated PVC forms"
}

No markdown.
`,
        ]);

        const text = result.response
            .text()
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        return JSON.parse(text);
    } catch (error) {
        console.warn("Gemini analysis failed:", error);
        return null;
    }
}

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as RequestBody;

        const {
            refImage,
            textureImage,
            prompt = "commercial inflatable product",
            userPrompt = "",
            productPreset = "",
            productType = "Custom",
            generateMode = "photo",
            referenceControl,
            dimensions,
            material = "PVC lucios",
            lighting = "Zi",
            shapeDetail = 35,
        } = body;

        const stabilityKey = process.env.STABILITY_API_KEY;
        const googleKey = process.env.GOOGLE_GENAI_API_KEY;

        if (!stabilityKey) {
            return NextResponse.json(
                { error: "Lipsește STABILITY_API_KEY în Vercel." },
                { status: 400 }
            );
        }

        const respectReference = clamp(
            Number(referenceControl?.respectReference ?? 85),
            0,
            100
        );

        const respectShape = referenceControl?.respectShape ?? true;
        const respectTexture = referenceControl?.respectTexture ?? true;
        const respectProportions = referenceControl?.respectProportions ?? true;
        const respectBranding = referenceControl?.respectBranding ?? true;
        const shapeDetailValue = clamp(Number(shapeDetail), 0, 100);

        const usingRefAsInitImage = shouldUseReferenceAsInitImage({
            refImage,
            generateMode,
            respectReference,
            productType,
            userPrompt,
            shapeDetail: shapeDetailValue,
        });

        const geminiAnalysis = refImage
            ? await analyzeReferenceWithGemini(refImage, googleKey)
            : null;

        const geminiPrompt = geminiAnalysis
            ? `
REFERENCE ANALYSIS:
Object type: ${geminiAnalysis.object_type}
Shape: ${geminiAnalysis.shape_description}
Texture: ${geminiAnalysis.texture_description}
Proportions: ${geminiAnalysis.proportions}
Inflatable conversion: ${geminiAnalysis.inflatable_conversion}
`
            : "";

        const finalPrompt = `
Generate ONLY a transparent PNG overlay of a commercial inflatable object.

DO NOT generate any background.
DO NOT use or modify the uploaded scene photo.
The background photo is handled only by the frontend and must remain unchanged.

USER REQUEST:
${userPrompt}

EXPANDED REQUEST:
${prompt}

PRODUCT PRESET:
${productPreset}

${getProductTypePrompt(productType, userPrompt)}

${getModePrompt(generateMode, respectReference)}

${getReferencePrompt({
    respectReference,
    respectShape,
    respectTexture,
    respectProportions,
    respectBranding,
    hasRefImage: Boolean(refImage),
    hasTextureImage: Boolean(textureImage),
    usingRefAsInitImage,
    shapeDetail: shapeDetailValue,
})}

${geminiPrompt}

${getDimensionsPrompt(dimensions)}

${getMaterialPrompt(material)}

${getLightingPrompt(lighting)}

${getShapeDetailPrompt(shapeDetailValue)}

ABSOLUTE OUTPUT:
- one single inflatable object;
- transparent background;
- complete object, not cropped;
- PVC air-filled appearance;
- soft rounded inflated edges;
- subtle PVC tension only;
- no scene;
- no building;
- no street;
- no sky;
- no people;
- no props;
- no real food;
- if subject is food, create a simplified inflatable food replica;
- clean edges suitable for compositing over a photo.
`.trim();

        const negativePrompt = getNegativePrompt({
            generateMode,
            respectReference,
            shapeDetail: shapeDetailValue,
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
                respectReference >= 96 && shapeDetailValue >= 75
                    ? "0.26"
                    : respectReference >= 90 && shapeDetailValue >= 60
                      ? "0.32"
                      : "0.42";

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
                productType,
                userPrompt,
                generateMode,
                respectReference,
                material,
                lighting,
                shapeDetail: shapeDetailValue,
                dimensions,
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
