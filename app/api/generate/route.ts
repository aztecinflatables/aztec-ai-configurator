import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60;

type GenerateMode = "rapid" | "photo" | "replica";
type RenderPipeline = "overlay" | "inpaint";

type RequestBody = {
    sceneImage?: string;
    maskImage?: string | null;
    refImage?: string | null;
    textureImage?: string | null;
    prompt?: string;
    userPrompt?: string;
    productPreset?: string;
    productType?: string;
    placementMode?: string;
    renderPipeline?: RenderPipeline;
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
        anchor?: string;
    };
    adjustments?: {
        scalePercent?: number;
        rotationDeg?: number;
        shadowX?: number;
        shadowY?: number;
        shadowScaleX?: number;
        shadowScaleY?: number;
        shadowBlur?: number;
        shadowOpacity?: number;
        shadowSkew?: number;
        objectBrightness?: number;
        objectContrast?: number;
        objectWarmth?: number;
        objectOpacity?: number;
    };
};

function base64ToBlob(base64: string, type = "image/jpeg") {
    const clean = base64.includes(",") ? base64.split(",")[1] : base64;
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return new Blob([bytes], { type });
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

function isBurgerSubject(text: string) {
    const t = normalizeText(text);
    return t.includes("burger") || t.includes("hamburger");
}

function getEffectiveProductData(options: {
    userPrompt: string;
    productType: string;
    productPreset: string;
}) {
    const combined = normalizeText(
        `${options.userPrompt} ${options.productType} ${options.productPreset}`
    );

    if (combined.includes("burger") || combined.includes("hamburger")) {
        return {
            productType: "Hamburger",
            productPreset:
                "Hamburger gonflabil publicitar, volum rotunjit, recognoscibil ca hamburger, realizabil în PVC lucios, cu formă simplificată și benzi late imprimate pentru ingrediente.",
            subjectLock:
                "The requested object is strictly a giant inflatable hamburger. Do not generate a mascot, face, cat, mask, helmet, animal, character or abstract white shape.",
        };
    }

    return {
        productType: options.productType,
        productPreset: options.productPreset,
        subjectLock:
            "The generated object must follow the written user request and the selected inflatable product type.",
    };
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

function getProductTypePrompt(
    productType?: string,
    userPrompt?: string,
    shapeDetail = 35,
    pipeline: RenderPipeline = "overlay"
) {
    const base = normalizeText(`${productType || ""} ${userPrompt || ""}`);

    if (base.includes("burger") || base.includes("hamburger")) {
        if (pipeline === "inpaint") {
            if (shapeDetail <= 15) {
                return `
PRODUCT TYPE: SIMPLIFIED GIANT INFLATABLE HAMBURGER.

Hard subject lock:
- the object must be a hamburger;
- not a mascot;
- not a cat;
- not a mask;
- not a face;
- not an animal;
- not a helmet;
- not a character.

Mandatory result:
- create a clearly recognizable hamburger-shaped inflatable object;
- use simplified inflated bun volumes;
- use broad horizontal color bands for patty / cheese / salad / tomato;
- no tiny lettuce leaves;
- no edible food material;
- no hyper-detailed ingredients;
- no realistic restaurant burger;
- the hamburger must sit inside the masked area;
- the bottom of the hamburger must touch the surface;
- create believable contact shadow directly under the hamburger;
- make it look like a PVC inflatable advertising object.
`.trim();
            }

            if (shapeDetail <= 35) {
                return `
PRODUCT TYPE: CLEAN INFLATABLE HAMBURGER REPLICA.

Hard subject lock:
- the object must be a hamburger;
- not a mascot, cat, mask, face, animal, helmet or character.

Mandatory result:
- recognizable hamburger inflatable;
- simple large inflated bun forms;
- simplified ingredient bands;
- limited medium details only;
- avoid tiny leaf geometry and realistic food texture;
- use glossy PVC printed surface;
- generate realistic contact with the scene surface and natural shadow.
`.trim();
            }

            return `
PRODUCT TYPE: GIANT INFLATABLE HAMBURGER PROMOTIONAL REPLICA.

Hard subject lock:
- the object must be a hamburger;
- not a mascot, cat, mask, face, animal, helmet or character.

Mandatory result:
- recognizable hamburger inflatable object;
- rounded air-filled bun, patty, cheese and salad elements;
- PVC surface with printed texture;
- realistic commercial inflatable, not edible food;
- fabricable simplified geometry;
- integrated contact shadows and scene lighting.
`.trim();
        }

        if (shapeDetail <= 10) {
            return `
PRODUCT TYPE: SIMPLE INFLATABLE HAMBURGER SIGN.

Hard subject lock:
- hamburger only;
- no mascot;
- no face;
- no cat;
- no mask.

Mandatory low-detail result:
- simple rounded flattened hamburger inflatable;
- broad printed horizontal bands;
- recognizably burger-themed;
- not a real edible burger.
`.trim();
        }

        if (shapeDetail <= 25) {
            return `
PRODUCT TYPE: SIMPLE INFLATABLE HAMBURGER PROMOTIONAL SHAPE.

Hard subject lock:
- hamburger only;
- no mascot, cat, mask, face or animal.

Mandatory result:
- one or maximum three large rounded inflatable pillow volumes;
- clear hamburger identity;
- broad printed PVC color bands;
- no detailed lettuce geometry;
- no detailed meat geometry;
- no sesame geometry.
`.trim();
        }

        return `
PRODUCT TYPE: GIANT INFLATABLE HAMBURGER PROMOTIONAL REPLICA.

Hard subject lock:
- hamburger only;
- no mascot, cat, mask, face or animal.

Mandatory rules:
- The subject is a hamburger, but the output must be a commercial inflatable object.
- It must not look like edible food photography.
- Burger identity should come from broad PVC color zones and inflated simplified forms.
- Use air-filled soft volumes and a clean rounded silhouette.
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

function getModePrompt(
    mode: GenerateMode,
    respectReference: number,
    pipeline: RenderPipeline
) {
    if (pipeline === "inpaint") {
        if (mode === "replica" || respectReference >= 86) {
            return `
GENERATION MODE: REALISTIC INPAINTED PRODUCT REPLICA.

Rules:
- edit only the masked area;
- preserve the original photograph outside the mask;
- create a believable commercial inflatable object inside the mask;
- match the camera perspective of the scene;
- match the lighting direction and exposure of the scene;
- create realistic contact shadows on the surface;
- the object must look physically placed in the real photo;
- do not alter building, pavement, vegetation, signs or background outside the object zone.
`.trim();
        }

        return `
GENERATION MODE: REALISTIC PHOTO INPAINT.

Rules:
- edit only the masked zone;
- preserve the original image outside the mask;
- insert a commercial inflatable object;
- match scene lighting, perspective and contact shadows;
- do not create a transparent overlay;
- generate the final integrated photo.
`.trim();
    }

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
    pipeline: RenderPipeline;
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
        pipeline,
    } = options;

    let prompt = `
REFERENCE CONTROL:
Reference strength: ${respectReference}/100.
Reference direct image-to-image: ${usingRefAsInitImage ? "ON" : "OFF"}.
Shape detail level: ${shapeDetail}/100.
Pipeline: ${pipeline}.
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

        if (pipeline === "inpaint") {
            if (shapeDetail <= 15) {
                prompt += `
- simplify the reference heavily but keep the object recognizable;
- do not make it abstract;
- avoid small physical details;
- use broad inflated forms and printed PVC color zones;`;
            } else if (shapeDetail <= 35) {
                prompt += `
- preserve main recognizable forms;
- simplify small details into printed PVC graphics;
- keep a clean inflatable silhouette;`;
            } else if (shapeDetail <= 70) {
                prompt += `
- preserve recognizable medium details;
- convert complex details into fabricable PVC panels;`;
            } else {
                prompt += `
- preserve the reference form closely but keep it fabricable as PVC inflatable;`;
            }
        } else {
            if (shapeDetail <= 10) {
                prompt += `
- keep only broad subject identity;
- physical reference details must be simplified;
- reference colors may become broad printed bands on the surface;`;
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

function getLightingPrompt(lighting: string, material: string, pipeline: RenderPipeline) {
    if (pipeline === "inpaint") {
        if (lighting === "Noapte") {
            return `
LIGHTING:
Match a night-composite result.
If the source photograph is daylight, still make the object visually compatible with the chosen night setting inside the mask, but do not darken the whole original photo.
If material is LED interior or translucent, create soft internal glow and believable local illumination.
Use realistic contact shadows.
`.trim();
        }

        if (lighting === "Golden hour") {
            return `
LIGHTING:
Match warm golden-hour object lighting.
Use warm highlights and realistic directional shadow.
Preserve the original photo outside the mask.
`.trim();
        }

        if (lighting === "Interior") {
            return `
LIGHTING:
Match indoor style object lighting.
Soft ambient reflections, realistic contact shadow.
Preserve the original photo outside the mask.
`.trim();
        }

        return `
LIGHTING:
Match the actual daylight visible in the source photograph.
Use consistent direction, exposure and contrast.
Create a natural contact shadow on the surface.
Preserve the original photo outside the mask.
`.trim();
    }

    if (lighting === "Noapte") {
        return `
LIGHTING:
The object itself must be rendered for NIGHT COMPOSITING.
Use dark-environment compatible shading.
Use darker ambient exposure.
Use stronger rim highlights and controlled specular reflections.
If material is LED interior or translucent, make it visibly softly illuminated from inside.
Do not use daylight exposure.
`.trim();
    }

    if (lighting === "Golden hour") {
        return `
LIGHTING:
The object itself must be rendered for GOLDEN HOUR COMPOSITING.
Use warm amber highlights.
Use a warm low sun direction.
Use soft evening reflections.
`.trim();
    }

    if (lighting === "Interior") {
        return `
LIGHTING:
The object itself must be rendered for INTERIOR COMPOSITING.
Use soft indoor reflections.
Use controlled ambient lighting.
`.trim();
    }

    return `
LIGHTING:
The object itself must be rendered for DAYLIGHT COMPOSITING.
Use natural outdoor daylight.
Clean neutral exposure.
Soft realistic object shading.
`.trim();
}

function getShapeDetailPrompt(
    shapeDetail: number,
    userPrompt: string,
    productType: string,
    pipeline: RenderPipeline
) {
    const subject = `${userPrompt} ${productType}`;
    const burgerLike = isBurgerSubject(subject);

    if (pipeline === "inpaint") {
        if (shapeDetail <= 10) {
            if (burgerLike) {
                return `
FORM COMPLEXITY:
LOW DETAIL BUT CLEARLY RECOGNIZABLE HAMBURGER.

For this hamburger:
- make it recognizably hamburger-shaped;
- use simplified inflated bun top and bun bottom;
- use broad printed bands for filling;
- no realistic edible texture;
- no tiny lettuce leaves;
- no face;
- no cat;
- no animal;
- no mask;
- no mascot;
- no character;
- the object must be a PVC inflatable hamburger sitting on the surface.
`.trim();
            }

            return `
FORM COMPLEXITY:
LOW DETAIL BUT RECOGNIZABLE.

Use large simple inflated forms.
Avoid small physical details.
Keep the object identity clear.
Make it a real PVC inflatable placed naturally in the scene.
`.trim();
        }

        if (shapeDetail <= 25) {
            return `
FORM COMPLEXITY:
SIMPLE COMMERCIAL INFLATABLE.

Use clean rounded inflated volumes.
Keep subject identity clear.
Use only broad medium details.
Avoid micro-details and jagged silhouette.
Generate realistic scene contact and shadows.
`.trim();
        }

        if (shapeDetail <= 55) {
            return `
FORM COMPLEXITY:
BALANCED INFLATABLE.

Use recognizable details but keep everything fabricable.
Complex details should become printed PVC graphics or broad inflated panels.
Natural contact shadow and scene integration are mandatory.
`.trim();
        }

        if (shapeDetail <= 80) {
            return `
FORM COMPLEXITY:
DETAILED INFLATABLE.

Preserve important subject details.
Use PVC seams and realistic printed texture.
Avoid edible/rigid object appearance.
Integrate perspective and contact shadows.
`.trim();
        }

        return `
FORM COMPLEXITY:
HIGH DETAIL INFLATABLE REPLICA.

Close recognizable replica while staying PVC-inflatable and manufacturable.
Use realistic commercial inflatable finish, integrated into the photo.
`.trim();
    }

    if (shapeDetail <= 5) {
        return `
FORM COMPLEXITY:
ABSOLUTE MINIMUM DETAIL.

The generated object must look like a simple inflatable advertising balloon with printed texture.
`.trim();
    }

    if (shapeDetail <= 15) {
        return `
FORM COMPLEXITY:
ULTRA SIMPLE INFLATABLE SHAPE.

Build the object from one to three large rounded primitive inflatable volumes.
Use smooth blobs, ellipsoids, capsules and rounded pillow forms.
The outer silhouette must be simple, clean and rounded.
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
`.trim();
    }

    if (shapeDetail <= 50) {
        return `
FORM COMPLEXITY:
SIMPLE COMMERCIAL INFLATABLE FORM.

Use large rounded inflated volumes.
Preserve subject identity, but simplify secondary details.
Small details should become printed graphics or simplified soft PVC forms.
`.trim();
    }

    if (shapeDetail <= 75) {
        return `
FORM COMPLEXITY:
BALANCED INFLATABLE FORM.

Preserve recognizable subject proportions and medium-size details.
Convert complex details into fabricable PVC panel logic.
`.trim();
    }

    if (shapeDetail <= 90) {
        return `
FORM COMPLEXITY:
DETAILED INFLATABLE FORM.

Preserve most important silhouette details and reference features.
Use welded PVC panel logic for detail.
`.trim();
    }

    return `
FORM COMPLEXITY:
VERY DETAILED INFLATABLE REPLICA.

Preserve the reference shape closely where possible.
Keep the object manufacturable as PVC inflatable panels.
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
`.trim();
}

function getPlacementPrompt(placementMode?: string, pipeline: RenderPipeline = "overlay") {
    if (pipeline === "inpaint") {
        if (placementMode === "Pe acoperiș") {
            return `
PLACEMENT INTENT:
The object is placed on a roof or elevated building surface inside the masked area.
Its bottom must visually touch the rooftop/surface.
Generate realistic contact shadow directly under the object.
Do not make it float.
Do not change the unmasked building or background.
`.trim();
        }

        if (placementMode === "Pe sol") {
            return `
PLACEMENT INTENT:
The object is placed on the ground inside the masked area.
Its base must visibly touch the ground.
Generate realistic contact shadow and grounding.
Do not make it float.
`.trim();
        }

        if (placementMode === "Pe fațadă") {
            return `
PLACEMENT INTENT:
The object is mounted on a vertical facade inside the masked area.
Generate wall contact shadow and correct vertical perspective.
Do not make it float away from the wall.
`.trim();
        }

        if (placementMode === "Suspendat") {
            return `
PLACEMENT INTENT:
The object is suspended or floating inside the masked area.
Use subtle believable shadow below it.
Do not add cables unless explicitly requested.
`.trim();
        }

        if (placementMode === "În interior") {
            return `
PLACEMENT INTENT:
The object is placed inside an interior scene.
Use indoor-style contact shadow and ambient lighting.
`.trim();
        }
    }

    if (placementMode === "Pe acoperiș") {
        return `
PLACEMENT INTENT:
The object will be composited on a roof.
Generate it with a clear bottom contact tangent suitable for rooftop placement.
`.trim();
    }

    if (placementMode === "Pe sol") {
        return `
PLACEMENT INTENT:
The object will be composited on the ground.
Generate it with a clear bottom contact tangent.
`.trim();
    }

    if (placementMode === "Pe fațadă") {
        return `
PLACEMENT INTENT:
The object will be composited on a vertical facade.
Generate it as if mounted close to a wall.
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
Generate clean object only.
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
    pipeline: RenderPipeline;
}) {
    const {
        generateMode,
        respectReference,
        shapeDetail,
        lighting,
        userPrompt,
        productType,
        pipeline,
    } = options;

    const burgerLike = isBurgerSubject(`${userPrompt} ${productType}`);

    let negative = `
people,
cars,
extra objects,
unrelated object,
watermark,
random text,
misspelled text,
logo artifacts,
normal real object,
real food,
real edible burger,
food photography,
wet food texture,
hard sculpture,
rigid plastic,
metal,
stone,
wood,
paper,
cardboard,
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
wrong scale,
bad perspective,
floating object,
object not touching surface,
no contact shadow
`.trim();

    if (burgerLike) {
        negative += `,
cat,
white cat,
cat head,
animal,
pet,
mascot,
face,
human face,
mask,
theater mask,
helmet,
character,
cartoon character,
blue tube,
blue cylinder,
lying object,
person next to object,
statue,
sculpture,
ordinary mascot`;
    }

    if (pipeline === "overlay") {
        negative += `,
background,
building,
street,
sky,
ground,
trees,
environment,
photo background,
changed background,
modified background photo,
cropped object,
cut off object,
bad transparent edges`;
    } else {
        negative += `,
changing unmasked background,
altered building outside mask,
changed windows outside mask,
changed pavement outside mask,
changed vegetation outside mask,
duplicated architecture,
distorted facade,
smearing background`;
    }

    if (shapeDetail <= 10) {
        if (burgerLike && pipeline === "inpaint") {
            negative += `,
abstract oval,
unrecognizable food,
plain ball,
plain sphere,
real restaurant burger,
hyper-detailed lettuce,
tiny sesame seeds,
tiny ingredient details,
floating burger,
no shadow`;
        } else {
            negative += `,
tiny details,
fine detail,
complex surface,
jagged contour,
thin detail`;
        }
    } else if (shapeDetail <= 30) {
        negative += `,
many small details,
complex noisy surface,
overdetailed geometry,
high frequency detail,
tiny parts,
complex topology`;
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
sunny object,
bright noon object lighting`;
    }

    if (lighting === "Zi") {
        negative += `,
night lighting,
neon glow`;
    }

    if (isFoodSubject(`${userPrompt} ${productType}`)) {
        negative += `,
ordinary burger,
real hamburger,
restaurant food,
edible food,
hyperrealistic food photo,
food macro texture`;
    }

    if (generateMode === "replica" || respectReference >= 88) {
        negative += `,
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

async function generateOverlayImage(options: {
    stabilityKey: string;
    refImage?: string | null;
    finalPrompt: string;
    negativePrompt: string;
    usingRefAsInitImage: boolean;
    respectReference: number;
    shapeDetailValue: number;
}) {
    const {
        stabilityKey,
        refImage,
        finalPrompt,
        negativePrompt,
        usingRefAsInitImage,
        respectReference,
        shapeDetailValue,
    } = options;

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
        throw new Error(`Eroare Stability Generate: ${errorText}`);
    }

    const generatedData = await generateResponse.json();

    if (!generatedData.image) {
        throw new Error("Stability nu a returnat nicio imagine.");
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
        return {
            overlayUrl: `data:image/png;base64,${generatedData.image}`,
            warning: "Remove background failed; using original generated image.",
        };
    }

    const bgData = await bgResponse.json();
    const finalImageBase64 = bgData.image || bgData.base64;

    if (!finalImageBase64) {
        return {
            overlayUrl: `data:image/png;base64,${generatedData.image}`,
            warning:
                "Remove background nu a returnat imagine; se folosește imaginea generată inițial.",
        };
    }

    return {
        overlayUrl: `data:image/png;base64,${finalImageBase64}`,
    };
}

async function generateInpaintImage(options: {
    stabilityKey: string;
    sceneImage: string;
    maskImage: string;
    finalPrompt: string;
    negativePrompt: string;
}) {
    const { stabilityKey, sceneImage, maskImage, finalPrompt, negativePrompt } =
        options;

    const imageBlob = base64ToBlob(sceneImage, "image/jpeg");
    const maskBlob = base64ToBlob(maskImage, "image/png");

    const formData = new FormData();
    formData.append("image", imageBlob, "scene.jpg");
    formData.append("mask", maskBlob, "mask.png");
    formData.append("prompt", finalPrompt);
    formData.append("negative_prompt", negativePrompt);
    formData.append("output_format", "png");

    const response = await fetch(
        "https://api.stability.ai/v2beta/stable-image/edit/inpaint",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${stabilityKey}`,
                Accept: "application/json",
            },
            body: formData,
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Eroare Stability Inpaint: ${errorText}`);
    }

    const data = await response.json();
    const imageBase64 = data.image || data.base64;

    if (!imageBase64) {
        throw new Error("Stability Inpaint nu a returnat imagine.");
    }

    return {
        resultSceneUrl: `data:image/png;base64,${imageBase64}`,
    };
}

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as RequestBody;

        const {
            sceneImage,
            maskImage,
            refImage,
            textureImage,
            prompt = "commercial inflatable product",
            userPrompt = "",
            productPreset = "",
            productType = "Custom",
            placementMode = "Pe sol",
            renderPipeline,
            generateMode = "photo",
            referenceControl,
            dimensions,
            material = "PVC lucios",
            lighting = "Zi",
            shapeDetail = 35,
            placement,
            adjustments,
        } = body;

        const stabilityKey = process.env.STABILITY_API_KEY;
        const googleKey = process.env.GOOGLE_GENAI_API_KEY;

        if (!stabilityKey) {
            return NextResponse.json(
                { error: "Lipsește STABILITY_API_KEY în Vercel." },
                { status: 400 }
            );
        }

        const pipeline: RenderPipeline =
            renderPipeline ||
            (generateMode === "rapid" ? "overlay" : "inpaint");

        if (pipeline === "inpaint" && !sceneImage) {
            return NextResponse.json(
                { error: "Pentru inpaint lipsește sceneImage." },
                { status: 400 }
            );
        }

        if (pipeline === "inpaint" && !maskImage) {
            return NextResponse.json(
                { error: "Pentru inpaint lipsește maskImage." },
                { status: 400 }
            );
        }

        const effective = getEffectiveProductData({
            userPrompt,
            productType,
            productPreset,
        });

        const effectiveProductType = effective.productType;
        const effectiveProductPreset = effective.productPreset;

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

        const usingRefAsInitImage =
            pipeline === "overlay" &&
            shouldUseReferenceAsInitImage({
                refImage,
                generateMode,
                respectReference,
                productType: effectiveProductType,
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

        const inpaintIntro =
            pipeline === "inpaint"
                ? `
TASK:
Edit the original photograph only inside the white masked area.
Insert the requested commercial inflatable object into that masked region.
The final output must be a full photo, not a transparent PNG.
The original background outside the masked area must remain unchanged.
The inserted object must touch the marked surface naturally and cast realistic contact shadows.
Respect the base-center placement implied by the mask.
`
                : `
TASK:
Generate ONLY a transparent PNG overlay of a commercial inflatable object.
DO NOT generate any background.
DO NOT use or modify the uploaded scene photo.
The background photo is handled only by the frontend and must remain unchanged.
`;

        const finalPrompt = `
${inpaintIntro}

STRICT SUBJECT LOCK:
${effective.subjectLock}

USER REQUEST:
${userPrompt}

EXPANDED REQUEST:
${prompt}

PRODUCT PRESET:
${effectiveProductPreset}

${getProductTypePrompt(effectiveProductType, userPrompt, shapeDetailValue, pipeline)}

${getPlacementPrompt(placementMode, pipeline)}

${getModePrompt(generateMode, respectReference, pipeline)}

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
    pipeline,
})}

${geminiPrompt}

${getDimensionsPrompt(dimensions)}

${getMaterialPrompt(material)}

${getLightingPrompt(lighting, material, pipeline)}

${getShapeDetailPrompt(shapeDetailValue, userPrompt, effectiveProductType, pipeline)}

PLACEMENT DATA:
- placement mode: ${placementMode}
- anchor: ${placement?.anchor || "base-center"}
- position x: ${placement?.x ?? "unknown"}%
- position y: ${placement?.y ?? "unknown"}%
- scale percent: ${adjustments?.scalePercent ?? "unknown"}%
- rotation: ${adjustments?.rotationDeg ?? 0} degrees

ABSOLUTE OUTPUT RULES:
${
    pipeline === "inpaint"
        ? `
- output is a complete edited photograph;
- modify only the masked area;
- keep all unmasked pixels visually unchanged;
- object must be inside the masked area;
- object must not float unless placement mode is Suspendat;
- create realistic local contact shadow;
- match perspective and focal length of the original photograph;
- match lighting and exposure of the original photograph;
- no extra people;
- no extra vehicles;
- no changed building geometry outside mask.
`
        : `
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
- clean edges suitable for compositing over a photo.
`
}
`.trim();

        const negativePrompt = getNegativePrompt({
            generateMode,
            respectReference,
            shapeDetail: shapeDetailValue,
            lighting,
            userPrompt,
            productType: effectiveProductType,
            pipeline,
        });

        if (pipeline === "inpaint") {
            const result = await generateInpaintImage({
                stabilityKey,
                sceneImage: sceneImage!,
                maskImage: maskImage!,
                finalPrompt,
                negativePrompt,
            });

            return NextResponse.json({
                resultSceneUrl: result.resultSceneUrl,
                compositedUrl: result.resultSceneUrl,
                finalImageUrl: result.resultSceneUrl,
                prompt: finalPrompt,
                negativePrompt,
                debug: {
                    pipeline,
                    originalProductType: productType,
                    effectiveProductType,
                    userPrompt,
                    placementMode,
                    generateMode,
                    respectReference,
                    material,
                    lighting,
                    shapeDetail: shapeDetailValue,
                    dimensions,
                    placement,
                    adjustments,
                    geminiAnalysis,
                },
            });
        }

        const overlayResult = await generateOverlayImage({
            stabilityKey,
            refImage,
            finalPrompt,
            negativePrompt,
            usingRefAsInitImage,
            respectReference,
            shapeDetailValue,
        });

        return NextResponse.json({
            overlayUrl: overlayResult.overlayUrl,
            warning: overlayResult.warning,
            prompt: finalPrompt,
            negativePrompt,
            debug: {
                pipeline,
                originalProductType: productType,
                effectiveProductType,
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
