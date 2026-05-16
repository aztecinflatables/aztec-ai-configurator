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
    placementMode?: string;
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

    if (shapeDetail <= 50) return false;

    if (isFoodSubject(combined) && respectReference < 97) return false;

    if (generateMode === "replica" && respectReference >= 90 && shapeDetail >= 65) {
        return true;
    }

    if (respectReference >= 95 && shapeDetail >= 80) {
        return true;
    }

    return false;
}

function getProductTypePrompt(productType?: string, userPrompt?: string, shapeDetail = 35) {
    const base = normalizeText(`${productType || ""} ${userPrompt || ""}`);

    if (base.includes("burger") || base.includes("hamburger")) {
        if (shapeDetail <= 10) {
            return `
PRODUCT TYPE: ABSTRACT SIMPLE INFLATABLE BURGER SIGN.

Mandatory low-detail result:
- Do NOT build a real burger.
- Do NOT build visible individual ingredients.
- Do NOT make lettuce, meat, cheese, tomato, sesame or bun as physical 3D geometry.
- Make one simple rounded flattened ellipsoid / pillow / oval balloon.
- The outer contour must be almost a clean oval.
- Burger identity must come only from broad printed horizontal color bands on the PVC surface.
- Think: a smooth inflatable oval sign printed like a burger, not a sculptural burger.
`.trim();
        }

        if (shapeDetail <= 25) {
            return `
PRODUCT TYPE: SIMPLE INFLATABLE BURGER PROMOTIONAL SHAPE.

Mandatory low-detail result:
- Make the burger as one or maximum three large rounded inflatable pillow volumes.
- Keep the outside contour clean and rounded.
- Avoid individual ingredient geometry.
- Use broad printed PVC color bands to suggest burger layers.
- No detailed lettuce geometry.
- No detailed meat geometry.
- No sesame geometry.
`.trim();
        }

        return `
PRODUCT TYPE: GIANT INFLATABLE BURGER PROMOTIONAL REPLICA.

Mandatory rules:
- The subject is a burger, but the output must be a commercial inflatable object.
- It must not look like edible food photography.
- It must not have real food geometry.
- Burger identity should come from broad PVC color zones and inflated simplified forms.
- Use air-filled soft volumes and a clean rounded silhouette.
- The surface texture may be photorealistic PVC print, but geometry must remain inflatable.
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
- preserve reference shape only when the detail slider is high enough;
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
- preserve the recognizable subject identity and silhouette logic from the reference;`;
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

        if (shapeDetail <= 10) {
            prompt += `
- override the reference geometry almost completely;
- keep only a very broad subject identity;
- convert the object into a smooth, flattened, rounded ellipsoid / oval pillow;
- physical reference details must disappear;
- reference colors may become broad printed bands on the surface;
- the outer 2D contour must be extremely simple and clean;`;
        } else if (shapeDetail <= 25) {
            prompt += `
- simplify the reference into one or a few large rounded inflatable masses;
- preserve only the main silhouette and major color zones;
- remove small physical details completely;
- convert small details into flat printed graphics;`;
        } else if (shapeDetail <= 45) {
            prompt += `
- simplify the reference into clean large inflatable volumes;
- preserve main recognizable forms;
- convert small details into printed graphics, not 3D relief;`;
        } else if (shapeDetail <= 70) {
            prompt += `
- preserve main recognizable forms and some medium details;
- simplify small details into PVC print or broad shapes;`;
        } else if (shapeDetail <= 90) {
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
Smooth air-filled surface, soft specular highlights, flexible pressurized material.
Texture can be photorealistic as a printed PVC surface, but the geometry must remain soft and inflatable.
`.trim();
    }

    if (material === "PVC mat") {
        return `
MATERIAL:
Matte inflatable PVC.
Soft diffuse reflections, clean professional PVC fabric look.
Texture can be photorealistic as a printed PVC surface, but the geometry must remain soft and inflatable.
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
The object should visibly glow from inside.
`.trim();
    }

    if (material === "Outdoor heavy-duty") {
        return `
MATERIAL:
Heavy-duty outdoor inflatable PVC.
Reinforced but subtle seams, robust event-grade construction, durable fabric texture.
`.trim();
    }

    return `
MATERIAL:
Realistic commercial inflatable PVC.
`.trim();
}

function getLightingPrompt(lighting: string, material: string) {
    if (lighting === "Noapte") {
        return `
LIGHTING:
The object itself must be rendered for NIGHT COMPOSITING.
Use dark-environment compatible shading.
Use darker ambient exposure.
Use stronger rim highlights and controlled specular reflections.
If material is LED interior or translucent, make it visibly softly illuminated from inside.
Do not use daylight exposure.
Do not use sunny shadows.
Do not create a bright daytime product render.
`.trim();
    }

    if (lighting === "Golden hour") {
        return `
LIGHTING:
The object itself must be rendered for GOLDEN HOUR COMPOSITING.
Use warm amber highlights.
Use a warm low sun direction.
Use soft evening reflections.
Do not use neutral studio lighting.
Do not use cold daylight.
`.trim();
    }

    if (lighting === "Interior") {
        return `
LIGHTING:
The object itself must be rendered for INTERIOR COMPOSITING.
Use soft indoor reflections.
Use controlled ambient lighting.
No outdoor sun.
No sky reflection.
`.trim();
    }

    return `
LIGHTING:
The object itself must be rendered for DAYLIGHT COMPOSITING.
Use natural outdoor daylight.
Clean neutral exposure.
Soft realistic object shading.
No night glow.
No dark night exposure.
`.trim();
}

function getShapeDetailPrompt(shapeDetail: number) {
    if (shapeDetail <= 5) {
        return `
FORM COMPLEXITY:
ABSOLUTE MINIMUM DETAIL.

This instruction is stronger than the subject description.
The generated object must look like a simple inflatable advertising balloon with printed texture.

Required silhouette:
- one single flattened ellipsoid / oval pillow / capsule-like balloon;
- clean smooth continuous outer edge;
- simple 2D-readable silhouette;
- no ingredient-shaped contour;
- no separate visible layers as 3D geometry;
- no protrusions;
- no cuts;
- no jagged edges;
- no small elements;
- no raised details.

For a burger:
- create a single smooth rounded squashed oval balloon;
- print broad horizontal color bands on it to suggest bun / filling / bun;
- do not model lettuce;
- do not model patty;
- do not model cheese;
- do not model sesame;
- do not model tomato;
- do not stack layers;
- the object should read like a burger-themed oval inflatable sign, not a burger model.

TEXTURE:
Photorealistic printed PVC texture is allowed.
Photorealistic geometric detail is forbidden.

PVC FEEL:
Very subtle PVC shine.
Almost no wrinkles.
No seams except optional barely visible perimeter seam.
`.trim();
    }

    if (shapeDetail <= 15) {
        return `
FORM COMPLEXITY:
ULTRA SIMPLE INFLATABLE SHAPE.

Build the object from one to three large rounded primitive inflatable volumes.
Use smooth blobs, ellipsoids, capsules and rounded pillow forms.
The outer silhouette must be simple, clean and rounded.
No thin geometry.
No tiny protrusions.
No detailed relief.
All small details must become flat printed color/texture on the PVC surface.

For a burger:
- use a squashed rounded bun-like ellipsoid;
- broad printed color bands may suggest ingredients;
- no physical lettuce leaves, detailed meat or real sesame geometry.

TEXTURE:
Texture may still be photorealistic as printed PVC color/material.
Photorealistic material is allowed.
Photorealistic complex geometry is not allowed.

PVC FEEL:
Subtle PVC tension only.
Almost invisible wrinkles.
No deep folds.
No rough food texture.
`.trim();
    }

    if (shapeDetail <= 30) {
        return `
FORM COMPLEXITY:
VERY SIMPLE INFLATABLE FORM.

Use large primitive inflated shapes.
Clear readable silhouette.
Very few geometry parts.
Secondary details must be printed, not modeled.
The object should look like a classic advertising inflatable made from big PVC volumes.

TEXTURE:
Surface can have photorealistic printed color/material.
Geometry remains simple and rounded.

PVC FEEL:
Only subtle PVC tension marks.
No deep folds.
No complex surface relief.
`.trim();
    }

    if (shapeDetail <= 50) {
        return `
FORM COMPLEXITY:
SIMPLE COMMERCIAL INFLATABLE FORM.

Use large rounded inflated volumes.
Preserve subject identity, but simplify secondary details.
Small details should become printed graphics or simplified soft PVC forms.

TEXTURE:
Photorealistic printed PVC surface is allowed.
Do not make the geometry overly detailed.

PVC FEEL:
Only subtle tension wrinkles near seams and edges.
No deep folds.
`.trim();
    }

    if (shapeDetail <= 75) {
        return `
FORM COMPLEXITY:
BALANCED INFLATABLE FORM.

Preserve recognizable subject proportions and medium-size details.
Convert complex details into fabricable PVC panel logic.
Keep the shape clean and stable.

TEXTURE:
Photorealistic printed surface and PVC highlights.

PVC FEEL:
Subtle PVC tension, mild seam definition, no excessive fabric folding.
`.trim();
    }

    if (shapeDetail <= 90) {
        return `
FORM COMPLEXITY:
DETAILED INFLATABLE FORM.

Preserve most important silhouette details and reference features.
Use welded PVC panel logic for detail.
Keep fabricability and stable air-filled construction.

TEXTURE:
Photorealistic PVC surface and printed texture allowed.

PVC FEEL:
Controlled subtle PVC tension only.
Do not create damaged or deflated wrinkles.
`.trim();
    }

    return `
FORM COMPLEXITY:
VERY DETAILED INFLATABLE REPLICA.

Preserve the reference shape closely where possible.
Keep the object manufacturable as PVC inflatable panels.
Complex details should still be simplified into inflatable construction or printed surface graphics.

TEXTURE:
Photorealistic PVC surface and printed texture allowed.

PVC FEEL:
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

function getPlacementPrompt(placementMode?: string) {
    if (placementMode === "Pe acoperiș") {
        return `
PLACEMENT INTENT:
The object will be composited on a roof.
Generate it with a clear bottom contact tangent suitable for rooftop placement.
Do not include the roof.
Do not include the building.
`.trim();
    }

    if (placementMode === "Pe sol") {
        return `
PLACEMENT INTENT:
The object will be composited on the ground.
Generate it with a clear bottom contact tangent.
Do not include the ground.
`.trim();
    }

    if (placementMode === "Pe fațadă") {
        return `
PLACEMENT INTENT:
The object will be composited on a vertical facade.
Generate it as if mounted close to a wall, but without wall or background.
`.trim();
    }

    if (placementMode === "Suspendat") {
        return `
PLACEMENT INTENT:
The object will be composited as suspended / floating.
Generate clean object only, without cables unless explicitly requested.
`.trim();
    }

    if (placementMode === "În interior") {
        return `
PLACEMENT INTENT:
The object will be composited inside a space.
Generate clean object only, without room or background.
`.trim();
    }

    return `
PLACEMENT INTENT:
Generate clean object only, no background.
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
real sesame geometry,
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
deep folds,
jagged silhouette,
sharp irregular edge,
thin protrusions,
complex cutouts,
high frequency geometry
`.trim();

    if (shapeDetail <= 5) {
        negative += `,
detailed burger,
burger model,
stacked burger,
stacked layers,
separate bun,
separate lettuce,
separate patty,
separate cheese,
separate tomato,
lettuce leaves,
detailed lettuce,
detailed meat,
burger patty relief,
sesame seed geometry,
cheese triangles protruding,
ingredient geometry,
many parts,
many layers,
complex object,
complex shape,
small geometry,
tiny details,
fine detail,
jagged food outline,
realistic food shape,
bumpy surface,
rough surface,
seam-heavy construction,
wrinkled fabric,
irregular silhouette,
sculptural burger,
3d food replica`;
    } else if (shapeDetail <= 15) {
        negative += `,
detailed geometry,
small geometry,
many parts,
many layers,
complex shape,
realistic food shape,
realistic burger geometry,
detailed lettuce,
detailed meat,
detailed sesame seeds,
wrinkled fabric,
seam-heavy construction,
bumpy surface,
rough surface,
thin edges,
irregular silhouette,
jagged food outline,
tiny details,
fine detail`;
    } else if (shapeDetail <= 30) {
        negative += `,
many small details,
complex noisy surface,
overdetailed geometry,
high frequency detail,
tiny parts,
complex topology,
realistic food geometry,
jagged food edge`;
    } else if (shapeDetail <= 50) {
        negative += `,
overdetailed geometry,
tiny parts,
complex topology,
deep folds,
noisy silhouette`;
    }

    if (lighting === "Noapte") {
        negative += `,
daylight,
sunny shadows,
bright noon lighting,
daytime product render`;
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
hyperrealistic food photo,
food photography,
food macro texture`;
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
            placementMode = "Pe sol",
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

${getProductTypePrompt(productType, userPrompt, shapeDetailValue)}

${getPlacementPrompt(placementMode)}

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

${getLightingPrompt(lighting, material)}

${getShapeDetailPrompt(shapeDetailValue)}

ABSOLUTE OUTPUT:
- one single inflatable object;
- transparent background;
- complete object, not cropped;
- PVC air-filled appearance;
- soft rounded inflated edges;
- simple clean outer silhouette when detail slider is low;
- texture may be photorealistic, but geometry must follow the selected detail level;
- subtle PVC tension only;
- no scene;
- no building;
- no street;
- no sky;
- no people;
- no props;
- no real food;
- if subject is food and detail is low, create a flattened ellipsoid printed as that food;
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
                placementMode,
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
