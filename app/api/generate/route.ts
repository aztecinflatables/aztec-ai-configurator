import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60;

type GenerateMode = "rapid" | "photo" | "replica";
type RenderPipeline = "overlay" | "inpaint";

type ResolvedIntent = {
    subject: string;
    productType: string;
    productPreset: string;
    subjectLock: string;
    negativeLock: string;
};

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
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ă/g, "a")
        .replace(/â/g, "a")
        .replace(/î/g, "i")
        .replace(/ș/g, "s")
        .replace(/ş/g, "s")
        .replace(/ț/g, "t")
        .replace(/ţ/g, "t");
}

function containsAny(text: string, terms: string[]) {
    const t = normalizeText(text);
    return terms.some((term) => t.includes(normalizeText(term)));
}

function cleanSubject(value: string) {
    return String(value || "")
        .replace(/\s+/g, " ")
        .replace(/\s+,/g, ",")
        .replace(/,+/g, ",")
        .trim();
}

function isExplicitArchitectureObject(text: string) {
    return containsAny(text, [
        "arcada",
        "arch",
        "tunel",
        "tunnel",
        "cort",
        "tent",
        "cupola",
        "dome",
        "poarta",
        "portal",
        "intrare",
        "stand",
        "pavilion",
    ]);
}

function isExplicitProductReplica(text: string) {
    return containsAny(text, [
        "sticla",
        "bottle",
        "doza",
        "can",
        "cutie",
        "box",
        "produs",
        "ambalaj",
        "pahar",
        "cup",
        "tub",
        "flacon",
        "recipient",
    ]);
}

function isExplicitFoodObject(text: string) {
    return containsAny(text, [
        "burger",
        "hamburger",
        "sandwich",
        "hotdog",
        "pizza",
        "cartof",
        "inghetata",
        "ice cream",
        "shaorma",
        "kebab",
        "gogoasa",
        "donut",
        "cafea",
        "coffee",
        "mancare",
        "food",
        "fruct",
        "mar",
        "banana",
        "capsuna",
    ]);
}

function isExplicitCharacterOrAnimal(text: string) {
    return containsAny(text, [
        "pinguin",
        "penguin",
        "catel",
        "caine",
        "dog",
        "pisica",
        "cat",
        "urs",
        "bear",
        "iepure",
        "rabbit",
        "leu",
        "lion",
        "tigru",
        "tiger",
        "elefant",
        "elephant",
        "dinozaur",
        "dinosaur",
        "dragon",
        "mascota",
        "mascot",
        "personaj",
        "character",
        "om",
        "human",
        "robot",
        "monstru",
        "monster",
        "animal",
    ]);
}

function resolveInflatableIntent(options: {
    userPrompt: string;
    selectedProductType: string;
    selectedProductPreset: string;
}) {
    const rawSubject = cleanSubject(options.userPrompt || "");
    const normalizedSubject = normalizeText(rawSubject);
    const selectedType = options.selectedProductType || "Custom";

    const hasExplicitArchitecture = isExplicitArchitectureObject(rawSubject);
    const hasExplicitProduct = isExplicitProductReplica(rawSubject);
    const hasExplicitFood = isExplicitFoodObject(rawSubject);
    const hasExplicitCharacter = isExplicitCharacterOrAnimal(rawSubject);

    if (containsAny(rawSubject, ["arcada", "arch", "poarta", "portal", "intrare"])) {
        return {
            subject: rawSubject || "arcadă gonflabilă",
            productType: "Arcadă",
            productPreset:
                "Arcadă gonflabilă publicitară premium, cu două picioare verticale stabile și traversă superioară rotunjită, proporții realiste, PVC lucios, construcție fabricabilă.",
            subjectLock:
                "The main subject is an inflatable arch / entrance structure. Do not generate a mascot, animal, face, food object or unrelated character.",
            negativeLock:
                "mascot, animal, face, cat, dog, penguin, burger, food, bottle, ordinary sculpture, unrelated character",
        };
    }

    if (containsAny(rawSubject, ["tunel", "tunnel"])) {
        return {
            subject: rawSubject || "tunel gonflabil",
            productType: "Tunel",
            productPreset:
                "Tunel gonflabil mare pentru evenimente sportive, structură lungă, intrare rotunjită, PVC lucios, stabil pe sol.",
            subjectLock:
                "The main subject is an inflatable tunnel. Do not generate a mascot, animal, face, food object, bottle or unrelated object.",
            negativeLock:
                "mascot, animal, face, cat, dog, penguin, burger, food, bottle, unrelated character",
        };
    }

    if (containsAny(rawSubject, ["cort", "tent", "pavilion"])) {
        return {
            subject: rawSubject || "cort gonflabil",
            productType: "Cort",
            productPreset:
                "Cort gonflabil pentru eveniment, structură tubulară gonflabilă, acoperiș moale, proporții realiste, aspect premium.",
            subjectLock:
                "The main subject is an inflatable event tent / pavilion. Do not generate a mascot, animal, food object, bottle, face or unrelated character.",
            negativeLock:
                "mascot, animal, face, cat, dog, penguin, burger, food, bottle, unrelated character",
        };
    }

    if (containsAny(rawSubject, ["cupola", "dome"])) {
        return {
            subject: rawSubject || "cupolă gonflabilă",
            productType: "Cupolă",
            productPreset:
                "Cupolă gonflabilă pentru eveniment, volum mare rotunjit, structură stabilă, material PVC rezistent outdoor, aspect premium.",
            subjectLock:
                "The main subject is an inflatable dome. Do not generate a mascot, animal, food object, bottle, face or unrelated character.",
            negativeLock:
                "mascot, animal, face, cat, dog, penguin, burger, food, bottle, unrelated character",
        };
    }

    if (hasExplicitProduct) {
        return {
            subject: rawSubject || "replică gonflabilă de produs",
            productType: "Replică produs",
            productPreset:
                "Replică gonflabilă de produs, proporții recognoscibile, volum moale, PVC lucios, formă simplificată și fabricabilă.",
            subjectLock:
                `The main subject is strictly this inflatable product replica: ${rawSubject}. Do not replace it with a mascot, animal, face, mask, food object or unrelated character.`,
            negativeLock:
                "mascot, animal, face, cat, dog, penguin, mask, helmet, unrelated character, unrelated food",
        };
    }

    if (hasExplicitFood) {
        return {
            subject: rawSubject || "obiect alimentar gonflabil",
            productType: "Replică food",
            productPreset:
                "Replică gonflabilă publicitară a unui produs alimentar, recognoscibilă, realizabilă în PVC lucios, cu formă simplificată și zone late imprimate pentru detalii.",
            subjectLock:
                `The main subject is strictly this inflatable food/product replica: ${rawSubject}. Do not generate a mascot, animal, face, mask, helmet, cat, dog, penguin or unrelated character.`,
            negativeLock:
                "mascot, animal, face, cat, dog, penguin, mask, helmet, character, ordinary mascot, person, unrelated object",
        };
    }

    if (hasExplicitCharacter) {
        return {
            subject: rawSubject || "mascotă gonflabilă",
            productType: "Mascotă",
            productPreset:
                `Mascotă gonflabilă mare reprezentând clar subiectul cerut: ${rawSubject}. Volum rotunjit, expresiv, stabil, realizabil în PVC gonflabil, formă simplificată dar recognoscibilă.`,
            subjectLock:
                `The main subject is strictly this inflatable mascot / character: ${rawSubject}. Do not replace it with a different animal, food object, arch, tunnel, bottle, mask or unrelated object.`,
            negativeLock:
                "wrong animal, wrong character, burger, food, bottle, arch, tunnel, tent, dome, unrelated object, theater mask, helmet",
        };
    }

    if (rawSubject.length >= 2) {
        return {
            subject: rawSubject,
            productType: "Custom",
            productPreset:
                `Obiect gonflabil personalizat reprezentând clar subiectul cerut: ${rawSubject}. Formă stabilă, material PVC profesional, volum rotunjit, fabricabil și recognoscibil.`,
            subjectLock:
                `The main subject is strictly the written user request: ${rawSubject}. The selected UI category is secondary. Do not replace it with another object type.`,
            negativeLock:
                "wrong subject, unrelated object, mascot if not requested, animal if not requested, food if not requested, arch if not requested, bottle if not requested",
        };
    }

    if (selectedType === "Arcadă") {
        return {
            subject: "arcadă gonflabilă",
            productType: "Arcadă",
            productPreset:
                "Arcadă gonflabilă publicitară premium, cu două picioare verticale stabile și traversă superioară rotunjită, proporții realiste, PVC lucios, construcție fabricabilă.",
            subjectLock:
                "The main subject is an inflatable arch. Do not generate another object type.",
            negativeLock:
                "mascot, animal, food, bottle, face, mask, unrelated object",
        };
    }

    if (selectedType === "Mascotă") {
        return {
            subject: "mascotă gonflabilă",
            productType: "Mascotă",
            productPreset:
                "Mascotă gonflabilă mare, volum rotunjit, expresivă, stabilă, realizabilă în PVC gonflabil, formă simplificată dar recognoscibilă.",
            subjectLock:
                "The main subject is an inflatable mascot. Do not generate an arch, tunnel, bottle or unrelated object.",
            negativeLock:
                "arch, tunnel, bottle, tent, dome, unrelated object",
        };
    }

    if (selectedType === "Cupolă") {
        return {
            subject: "cupolă gonflabilă",
            productType: "Cupolă",
            productPreset:
                "Cupolă gonflabilă pentru eveniment, volum mare rotunjit, structură stabilă, material PVC rezistent outdoor, aspect premium.",
            subjectLock:
                "The main subject is an inflatable dome. Do not generate another object type.",
            negativeLock:
                "mascot, animal, food, bottle, face, mask, unrelated object",
        };
    }

    if (selectedType === "Cort") {
        return {
            subject: "cort gonflabil",
            productType: "Cort",
            productPreset:
                "Cort gonflabil pentru eveniment, structură tubulară gonflabilă, acoperiș moale, proporții realiste, aspect premium.",
            subjectLock:
                "The main subject is an inflatable event tent. Do not generate another object type.",
            negativeLock:
                "mascot, animal, food, bottle, face, mask, unrelated object",
        };
    }

    if (selectedType === "Tunel") {
        return {
            subject: "tunel gonflabil",
            productType: "Tunel",
            productPreset:
                "Tunel gonflabil mare pentru evenimente sportive, structură lungă, intrare rotunjită, PVC lucios, stabil pe sol.",
            subjectLock:
                "The main subject is an inflatable tunnel. Do not generate another object type.",
            negativeLock:
                "mascot, animal, food, bottle, face, mask, unrelated object",
        };
    }

    if (selectedType === "Sticlă") {
        return {
            subject: "sticlă gonflabilă",
            productType: "Sticlă",
            productPreset:
                "Replică gonflabilă de produs în formă de sticlă, proporții recognoscibile, volum moale, PVC lucios, fabricabilă.",
            subjectLock:
                "The main subject is an inflatable bottle / product replica. Do not generate another object type.",
            negativeLock:
                "mascot, animal, food, arch, tunnel, face, mask, unrelated object",
        };
    }

    return {
        subject: rawSubject || "obiect gonflabil personalizat",
        productType: "Custom",
        productPreset:
            options.selectedProductPreset ||
            "Obiect gonflabil personalizat, realist, fabricabil, cu formă stabilă, material PVC profesional și proporții comerciale.",
        subjectLock:
            "The generated object must follow the written user request. The UI category is only secondary.",
        negativeLock:
            "wrong subject, unrelated object, random mascot, random animal, random face, random mask",
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
    if (isExplicitFoodObject(combined) && respectReference < 97) return false;

    if (generateMode === "replica" && respectReference >= 90 && shapeDetail >= 65) {
        return true;
    }

    if (respectReference >= 95 && shapeDetail >= 80) {
        return true;
    }

    return false;
}

function getProductTypePrompt(
    intent: ResolvedIntent,
    shapeDetail = 35,
    pipeline: RenderPipeline = "overlay"
) {
    const subject = intent.subject;
    const productType = intent.productType;
    const lowDetail = shapeDetail <= 15;
    const mediumDetail = shapeDetail <= 45;

    if (pipeline === "inpaint") {
        return `
PRODUCT TYPE:
${productType}

SUBJECT:
${subject}

STRICT SUBJECT RULE:
${intent.subjectLock}

Mandatory result:
- create a commercial inflatable object representing the subject above;
- keep the object inside the white masked area;
- preserve the original photograph outside the mask;
- make the object physically touch the intended surface unless placement is suspended;
- generate believable local contact shadow;
- match the camera perspective and lighting of the original photo;
- use PVC inflatable construction, rounded air-filled volumes and fabricable forms;
- do not replace the requested subject with a different category;
${
    lowDetail
        ? "- low detail means simplified but still recognizable, not abstract and not a wrong object;"
        : ""
}
${
    mediumDetail
        ? "- avoid micro-details, tiny geometry and over-complex surfaces;"
        : "- allow more recognizable details, but keep everything fabricable as a PVC inflatable;"
}
`.trim();
    }

    return `
PRODUCT TYPE:
${productType}

SUBJECT:
${subject}

STRICT SUBJECT RULE:
${intent.subjectLock}

Mandatory result:
- generate one clean transparent PNG overlay of the inflatable object;
- no background;
- no scene;
- no people;
- PVC inflatable construction;
- rounded air-filled volumes;
- fabricable commercial inflatable form;
- do not replace the requested subject with a different object;
${
    lowDetail
        ? "- low detail means simplified but still recognizable, not abstract and not a wrong object;"
        : ""
}
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
- generate the final integrated photo.
`.trim();
    }

    if (mode === "replica" || respectReference >= 86) {
        return `
GENERATION MODE: CONTROLLED INFLATABLE REPLICA.

Rules:
- preserve the requested subject;
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
- readable silhouette;
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

        if (shapeDetail <= 15) {
            prompt += `
- simplify heavily but keep the subject recognizable;
- do not make it abstract;
- avoid tiny physical details;
- use broad inflated forms and printed PVC color zones;`;
        } else if (shapeDetail <= 45) {
            prompt += `
- preserve main recognizable forms;
- simplify small details into printed PVC graphics;
- keep a clean inflatable silhouette;`;
        } else if (shapeDetail <= 75) {
            prompt += `
- preserve recognizable medium details;
- convert complex details into fabricable PVC panels;`;
        } else {
            prompt += `
- preserve the reference form closely but keep it fabricable as PVC inflatable;`;
        }
    } else {
        prompt += `

No product reference image was uploaded.
Generate from the written request and resolved product intent.`;
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
Texture can be photorealistic as printed PVC, but geometry must remain soft and inflatable.
`.trim();
    }

    if (material === "PVC mat") {
        return `
MATERIAL:
Matte inflatable PVC.
Soft diffuse reflections, clean professional PVC fabric look.
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
Subtle seams, robust event-grade construction, durable fabric texture.
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
If the source photograph is daylight, keep the original photo unchanged outside the mask.
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
Match indoor-style object lighting.
Soft ambient reflections and realistic contact shadow.
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
Render the object for night compositing.
Use darker ambient exposure, rim highlights and controlled reflections.
If material is LED interior or translucent, make it softly illuminated from inside.
`.trim();
    }

    if (lighting === "Golden hour") {
        return `
LIGHTING:
Render the object for golden-hour compositing.
Use warm amber highlights and low sun direction.
`.trim();
    }

    if (lighting === "Interior") {
        return `
LIGHTING:
Render the object for interior compositing.
Soft indoor reflections, controlled ambient lighting.
`.trim();
    }

    return `
LIGHTING:
Render the object for daylight compositing.
Use natural outdoor daylight and clean neutral exposure.
`.trim();
}

function getShapeDetailPrompt(shapeDetail: number, intent: ResolvedIntent, pipeline: RenderPipeline) {
    const subject = intent.subject;

    if (pipeline === "inpaint") {
        if (shapeDetail <= 10) {
            return `
FORM COMPLEXITY:
LOW DETAIL BUT CLEARLY RECOGNIZABLE.

For subject "${subject}":
- keep the subject readable immediately;
- simplify into large rounded inflatable volumes;
- avoid tiny details, micro texture and jagged shapes;
- do not replace the subject with another object;
- do not make it abstract;
- PVC inflatable appearance is mandatory;
- object must touch the surface naturally.
`.trim();
        }

        if (shapeDetail <= 25) {
            return `
FORM COMPLEXITY:
SIMPLE COMMERCIAL INFLATABLE.

For subject "${subject}":
- use clean rounded inflated volumes;
- keep subject identity clear;
- use only broad medium details;
- avoid micro-details and noisy edges;
- create realistic scene contact and shadows.
`.trim();
        }

        if (shapeDetail <= 55) {
            return `
FORM COMPLEXITY:
BALANCED INFLATABLE.

For subject "${subject}":
- use recognizable details but keep everything fabricable;
- complex details should become printed PVC graphics or broad inflated panels;
- natural contact shadow and scene integration are mandatory.
`.trim();
        }

        if (shapeDetail <= 80) {
            return `
FORM COMPLEXITY:
DETAILED INFLATABLE.

For subject "${subject}":
- preserve important subject details;
- use PVC seams and realistic printed texture;
- avoid edible, rigid or sculpture-like appearance unless specifically requested;
- integrate perspective and contact shadows.
`.trim();
        }

        return `
FORM COMPLEXITY:
HIGH DETAIL INFLATABLE REPLICA.

For subject "${subject}":
- close recognizable replica while staying PVC-inflatable and manufacturable;
- use realistic commercial inflatable finish, integrated into the photo.
`.trim();
    }

    if (shapeDetail <= 10) {
        return `
FORM COMPLEXITY:
LOW DETAIL OVERLAY.

For subject "${subject}":
- simplified but recognizable;
- one to three large rounded inflatable volumes;
- no tiny details;
- no wrong object substitution.
`.trim();
    }

    if (shapeDetail <= 30) {
        return `
FORM COMPLEXITY:
SIMPLE INFLATABLE OVERLAY.

For subject "${subject}":
- large primitive inflated shapes;
- clear readable silhouette;
- secondary details should be printed, not modeled.
`.trim();
    }

    if (shapeDetail <= 60) {
        return `
FORM COMPLEXITY:
BALANCED INFLATABLE OVERLAY.

For subject "${subject}":
- recognizable subject proportions;
- clean inflatable construction;
- fabricable PVC panel logic.
`.trim();
    }

    return `
FORM COMPLEXITY:
DETAILED INFLATABLE OVERLAY.

For subject "${subject}":
- preserve important silhouette details;
- use welded PVC panel logic;
- keep it manufacturable.
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
- Respect approximate height / width / length ratio.
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

    return `
PLACEMENT INTENT:
${placementMode || "Custom"}.
Generate clean object only for compositing.
`.trim();
}

function getNegativePrompt(options: {
    generateMode: GenerateMode;
    respectReference: number;
    shapeDetail: number;
    lighting: string;
    intent: ResolvedIntent;
    pipeline: RenderPipeline;
}) {
    const { generateMode, respectReference, shapeDetail, lighting, intent, pipeline } =
        options;

    let negative = `
${intent.negativeLock},
wrong subject,
unrelated object,
extra people,
extra vehicles,
watermark,
random text,
misspelled text,
logo artifacts,
normal rigid object,
hard sculpture,
stone,
wood,
metal,
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
wrong scale,
bad perspective,
floating object,
object not touching surface,
no contact shadow
`.trim();

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
smearing background,
changing original image outside the mask`;
    }

    if (shapeDetail <= 10) {
        negative += `,
unrecognizable subject,
abstract object,
plain ball,
plain sphere,
tiny details,
fine detail,
complex noisy surface,
jagged contour`;
    } else if (shapeDetail <= 30) {
        negative += `,
overdetailed geometry,
high frequency detail,
tiny parts,
complex topology`;
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
            renderPipeline || (generateMode === "rapid" ? "overlay" : "inpaint");

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

        const intent = resolveInflatableIntent({
            userPrompt,
            selectedProductType: productType,
            selectedProductPreset: productPreset,
        });

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
                productType: intent.productType,
                userPrompt: intent.subject,
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

RESOLVED INTENT:
Subject: ${intent.subject}
Product type: ${intent.productType}
Preset: ${intent.productPreset}

STRICT SUBJECT LOCK:
${intent.subjectLock}

USER RAW REQUEST:
${userPrompt}

UI SELECTED TYPE:
${productType}

RULE:
The written user request is the primary source of truth.
The selected UI type is secondary and must not override a clear subject in the text.

EXPANDED REQUEST:
${prompt}

${getProductTypePrompt(intent, shapeDetailValue, pipeline)}

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

${getShapeDetailPrompt(shapeDetailValue, intent, pipeline)}

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
- no changed building geometry outside mask;
- do not change the requested subject.
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
- clean edges suitable for compositing over a photo;
- do not change the requested subject.
`
}
`.trim();

        const negativePrompt = getNegativePrompt({
            generateMode,
            respectReference,
            shapeDetail: shapeDetailValue,
            lighting,
            intent,
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
                    resolvedProductType: intent.productType,
                    resolvedSubject: intent.subject,
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
                resolvedProductType: intent.productType,
                resolvedSubject: intent.subject,
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
