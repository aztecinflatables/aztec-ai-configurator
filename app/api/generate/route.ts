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

    if (isFoodSubject(combined) && respectReference < 92) return false;

    if (generateMode === "replica" && respectReference >= 88) return true;

    return false;
}

function getProductTypePrompt(productType?: string, userPrompt?: string) {
    const base = normalizeText(`${productType || ""} ${userPrompt || ""}`);

    if (base.includes("burger") || base.includes("hamburger")) {
        return `
PRODUCT TYPE: GIANT INFLATABLE BURGER PROMOTIONAL REPLICA.

Mandatory geometry:
- simplified air-filled burger silhouette;
- large rounded bun volumes;
- simplified inflated cheese / lettuce / patty layers;
- all layers must look like PVC inflatable tubes or soft inflated panels;
- avoid realistic edible detail;
- no wet food material;
- no real food photography;
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
    if (mode === "replica" || respectReference >= 88) {
        return `
GENERATION MODE: STRICT INFLATABLE REPLICA.

Rules:
- preserve the requested subject;
- preserve reference shape only when reference is provided and relevant;
- convert the design into a real commercial inflatable;
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
- controlled amount of detail;
- no scenery or background.
`.trim();
    }

    return `
GENERATION MODE: CLEAN MOCKUP.

Rules:
- simple geometry;
- very readable silhouette;
- minimal wrinkles;
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
REFERENCE CONTROL:
Reference strength: ${respectReference}/100.
Reference direct image-to-image: ${usingRefAsInitImage ? "ON" : "OFF"}.
`.trim();

    if (hasRefImage) {
        prompt += `

A product reference image was uploaded.
Use it as product design reference only.`;

        if (respectShape) {
            prompt += `
- preserve the recognizable shape and silhouette logic;`;
        }

        if (respectProportions) {
            prompt += `
- preserve approximate proportions;`;
        }

        if (respectTexture) {
            prompt += `
- preserve useful color / texture / pattern logic as printable PVC graphics;`;
        }

        if (respectBranding) {
            prompt += `
- preserve branding placement only if clearly visible; do not invent random text;`;
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
Darker overall exposure, strong controlled highlights, optional soft glow only if material supports it.
No daylight shadows.
No sunny look.
`.trim();
    }

    if (lighting === "Golden hour") {
        return `
LIGHTING:
Warm golden-hour object lighting.
Amber highlights, soft long-shadow direction, warm commercial outdoor mood.
`.trim();
    }

    if (lighting === "Interior") {
        return `
LIGHTING:
Interior-compatible object lighting.
Soft controlled indoor reflections and subdued shadows.
`.trim();
    }

    return `
LIGHTING:
Daylight-compatible object lighting.
Natural outdoor highlights, clean neutral exposure, no night glow.
`.trim();
}

function getDetailPrompt(realism: number) {
    if (realism <= 20) {
        return `
DETAIL LEVEL: VERY SIMPLE.
Build from basic inflated primitive shapes only.
Large clean volumes.
Almost no seams.
No small details.
No wrinkles.
Toy-block simplicity but with PVC inflatable material.
`.trim();
    }

    if (realism <= 45) {
        return `
DETAIL LEVEL: SIMPLE COMMERCIAL.
Simple inflated forms.
Few seams.
Very subtle wrinkles only.
Clear silhouette.
Avoid small noisy details.
`.trim();
    }

    if (realism <= 70) {
        return `
DETAIL LEVEL: BALANCED.
Moderate seams.
Mild PVC tension lines.
Controlled wrinkles.
Professional inflatable visualization.
`.trim();
    }

    return `
DETAIL LEVEL: DETAILED.
Visible seams and PVC tension.
Still clean, pressurized and professional.
Avoid chaotic folds and deflated fabric.
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
- Respect the height/width/length ratio in the generated object.
- These are product dimensions, not background dimensions.
- Frontend handles final placement and scale over the photo.
`.trim();
}

function getNegativePrompt(options: {
    generateMode: GenerateMode;
    respectReference: number;
    realism: number;
    lighting: string;
    userPrompt: string;
    productType: string;
}) {
    const {
        generateMode,
        respectReference,
        realism,
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
logo artifacts
`.trim();

    if (realism <= 45) {
        negative += `,
many wrinkles,
deep folds,
complex noisy surface,
damaged fabric,
dirty PVC,
overdetailed geometry`;
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
creative redesign,
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
            realism = 45,
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
})}

${geminiPrompt}

${getDimensionsPrompt(dimensions)}

${getMaterialPrompt(material)}

${getLightingPrompt(lighting)}

${getDetailPrompt(realismValue)}

ABSOLUTE OUTPUT:
- one single inflatable object;
- transparent background;
- complete object, not cropped;
- PVC air-filled appearance;
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
                    ? "0.28"
                    : respectReference >= 88
                      ? "0.34"
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
                productType,
                userPrompt,
                generateMode,
                respectReference,
                material,
                lighting,
                realism: realismValue,
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
