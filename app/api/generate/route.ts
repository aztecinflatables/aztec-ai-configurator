import { NextResponse } from "next/server";

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
    selectedUiProductType?: string;
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
        inpaintAreaScale?: number;
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

type ResolvedIntent = {
    subject: string;
    type: string;
    overlayPrompt: string;
    inpaintPrompt: string;
    negative: string;
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
        .replace(/ţ/g, "t")
        .trim();
}

function cleanSubject(value?: string) {
    return String(value || "")
        .replace(/\s+/g, " ")
        .replace(/\s+,/g, ",")
        .replace(/,+/g, ",")
        .trim();
}

function hasAny(text: string, terms: string[]) {
    const t = normalizeText(text);
    return terms.some((term) => t.includes(normalizeText(term)));
}

function getMaterialText(material?: string) {
    if (material === "PVC mat") {
        return "matte inflatable PVC, soft commercial inflatable fabric, clean welded seams";
    }

    if (material === "Alb translucid") {
        return "white translucent inflatable PVC, soft milky material, subtle internal light scattering";
    }

    if (material === "LED interior") {
        return "translucent inflatable PVC with soft internal LED glow, illuminated from inside";
    }

    if (material === "Outdoor heavy-duty") {
        return "heavy duty outdoor inflatable PVC, durable commercial event material, subtle welded seams";
    }

    return "glossy inflatable PVC, smooth shiny air-filled surface, commercial advertising inflatable material";
}

function getLightingText(lighting?: string) {
    if (lighting === "Noapte") {
        return "night compositing lighting, darker ambient exposure, controlled highlights";
    }

    if (lighting === "Golden hour") {
        return "warm golden hour lighting, amber highlights, soft contrast";
    }

    if (lighting === "Interior") {
        return "soft indoor lighting, controlled reflections";
    }

    return "neutral daylight product lighting, clean reflections";
}

function getDetailText(shapeDetail: number) {
    if (shapeDetail <= 10) {
        return "very simplified but still instantly recognizable silhouette, large rounded inflated volumes only, minimal details printed on the surface";
    }

    if (shapeDetail <= 25) {
        return "simple recognizable inflatable form, broad rounded shapes, few large printed details, no tiny parts";
    }

    if (shapeDetail <= 55) {
        return "balanced recognizable inflatable replica, clear main features, fabricable PVC panel logic";
    }

    return "detailed but still fabricable inflatable replica, recognizable features as broad PVC panels and printed graphics";
}

function resolveIntent(userPrompt?: string, productType?: string): ResolvedIntent {
    const raw = cleanSubject(userPrompt || "custom inflatable object");
    const text = normalizeText(raw);
    const selected = normalizeText(productType);

    if (hasAny(text, ["burger", "hamburger", "cheeseburger"])) {
        return {
            subject: raw,
            type: "hamburger inflatable replica",
            overlayPrompt:
                "ONE SINGLE inflatable hamburger replica, unmistakably a hamburger, rounded top bun with sesame seed print, bottom bun, visible lettuce band, cheese slice band, burger patty band, optional tomato band, broad soft air-filled PVC volumes, commercial advertising inflatable, centered isolated object, transparent background",
            inpaintPrompt:
                "a large commercial inflatable hamburger replica placed in the marked area, unmistakably a hamburger, rounded bun, sesame seed print, lettuce, cheese, patty, glossy PVC, realistic contact shadow",
            negative:
                "not a hamburger, generic tube, blue tube, abstract shape, arch, tunnel, letter shape, number shape, hook shape, mascot, animal, person, human, costume, multiple burgers, repeated burgers, collage, pattern, food pile",
        };
    }

    if (hasAny(text, ["pinguin", "penguin"])) {
        return {
            subject: raw,
            type: "penguin inflatable mascot",
            overlayPrompt:
                "ONE SINGLE inflatable penguin mascot, unmistakably a penguin, black and white penguin body, white belly, black back and head, small orange beak, small orange feet, rounded soft air-filled PVC volumes, cute commercial inflatable mascot, centered isolated object, transparent background",
            inpaintPrompt:
                "a large inflatable penguin mascot placed in the marked area, unmistakably a penguin, black and white body, white belly, orange beak, orange feet, glossy PVC, realistic contact shadow",
            negative:
                "not a penguin, generic tube, blue tube, abstract shape, arch, tunnel, letter shape, number shape, hook shape, burger, food, dog, cat, human, person, costume, wearable costume, multiple objects, collage, pattern",
        };
    }

    if (hasAny(text, ["catel", "caine", "dog", "puppy"])) {
        return {
            subject: raw,
            type: "dog inflatable mascot",
            overlayPrompt:
                "ONE SINGLE inflatable dog mascot, unmistakably a dog, cute rounded dog head, floppy ears, snout, paws, soft air-filled PVC body, commercial inflatable mascot, centered isolated object, transparent background",
            inpaintPrompt:
                "a large inflatable dog mascot placed in the marked area, unmistakably a dog, rounded head, ears, snout, paws, glossy PVC, realistic contact shadow",
            negative:
                "not a dog, generic tube, blue tube, abstract shape, arch, tunnel, burger, penguin, cat, person, human, costume, multiple objects, collage, pattern",
        };
    }

    if (hasAny(text, ["pisica", "cat", "kitten"])) {
        return {
            subject: raw,
            type: "cat inflatable mascot",
            overlayPrompt:
                "ONE SINGLE inflatable cat mascot, unmistakably a cat, rounded cat head, pointed ears, whisker print, paws, soft air-filled PVC body, commercial inflatable mascot, centered isolated object, transparent background",
            inpaintPrompt:
                "a large inflatable cat mascot placed in the marked area, unmistakably a cat, pointed ears, whisker print, paws, glossy PVC, realistic contact shadow",
            negative:
                "not a cat, generic tube, blue tube, abstract shape, arch, tunnel, burger, penguin, dog, person, human, costume, multiple objects, collage, pattern",
        };
    }

    if (hasAny(text, ["urs", "bear"])) {
        return {
            subject: raw,
            type: "bear inflatable mascot",
            overlayPrompt:
                "ONE SINGLE inflatable bear mascot, unmistakably a bear, rounded bear head, small round ears, big soft body, paws, commercial inflatable PVC mascot, centered isolated object, transparent background",
            inpaintPrompt:
                "a large inflatable bear mascot placed in the marked area, unmistakably a bear, rounded head, small ears, paws, glossy PVC, realistic contact shadow",
            negative:
                "not a bear, generic tube, blue tube, abstract shape, arch, tunnel, burger, penguin, dog, person, human, costume, multiple objects, collage, pattern",
        };
    }

    if (hasAny(text, ["arcada", "arcadă", "arch", "poarta", "portal", "intrare"])) {
        return {
            subject: raw,
            type: "inflatable arch",
            overlayPrompt:
                "ONE SINGLE inflatable advertising arch, two vertical legs and one rounded top beam, stable commercial PVC structure, glossy inflatable tubes, centered isolated object, transparent background",
            inpaintPrompt:
                "a large inflatable advertising arch placed in the marked area, two vertical legs and rounded top beam, glossy PVC, realistic contact shadow",
            negative:
                "penguin, dog, cat, burger, animal, person, human, mascot character, generic pile, multiple objects, collage, pattern",
        };
    }

    if (hasAny(text, ["tunel", "tunnel"])) {
        return {
            subject: raw,
            type: "inflatable tunnel",
            overlayPrompt:
                "ONE SINGLE inflatable tunnel, rounded entrance, long soft PVC tunnel body, commercial sports event inflatable, centered isolated object, transparent background",
            inpaintPrompt:
                "a large inflatable tunnel placed in the marked area, rounded entrance, long PVC body, realistic contact shadow",
            negative:
                "penguin, dog, cat, burger, animal, person, human, mascot character, arch if not requested, multiple objects, collage, pattern",
        };
    }

    if (hasAny(text, ["cort", "tent", "pavilion"])) {
        return {
            subject: raw,
            type: "inflatable tent",
            overlayPrompt:
                "ONE SINGLE inflatable event tent, soft PVC tubular frame, roof canopy, commercial outdoor inflatable pavilion, centered isolated object, transparent background",
            inpaintPrompt:
                "a large inflatable event tent placed in the marked area, soft PVC tubular frame and roof canopy, realistic contact shadow",
            negative:
                "penguin, dog, cat, burger, animal, person, human, mascot character, multiple objects, collage, pattern",
        };
    }

    if (hasAny(text, ["cupola", "cupolă", "dome"])) {
        return {
            subject: raw,
            type: "inflatable dome",
            overlayPrompt:
                "ONE SINGLE inflatable dome, rounded hemispherical PVC structure, commercial event inflatable, soft air-filled volume, centered isolated object, transparent background",
            inpaintPrompt:
                "a large inflatable dome placed in the marked area, rounded hemispherical PVC structure, realistic contact shadow",
            negative:
                "penguin, dog, cat, burger, animal, person, human, mascot character, multiple objects, collage, pattern",
        };
    }

    if (
        hasAny(text, [
            "sticla",
            "sticlă",
            "bottle",
            "doza",
            "can",
            "cutie",
            "box",
            "pahar",
            "cup",
            "flacon",
            "recipient",
        ]) ||
        selected.includes("sticla")
    ) {
        return {
            subject: raw,
            type: "inflatable product replica",
            overlayPrompt:
                `ONE SINGLE inflatable product replica of ${raw}, unmistakably matching the requested product type, rounded soft PVC volume, commercial advertising inflatable, centered isolated object, transparent background`,
            inpaintPrompt:
                `a large inflatable product replica of ${raw} placed in the marked area, glossy PVC, realistic contact shadow`,
            negative:
                "person, human, costume, mascot character, animal, burger if not requested, generic tube, abstract shape, multiple objects, collage, pattern",
        };
    }

    if (
        hasAny(text, [
            "pizza",
            "hotdog",
            "hot dog",
            "sandwich",
            "inghetata",
            "ice cream",
            "donut",
            "gogoasa",
            "banana",
            "mar",
            "fruct",
        ])
    ) {
        return {
            subject: raw,
            type: "food inflatable replica",
            overlayPrompt:
                `ONE SINGLE inflatable food replica of ${raw}, unmistakably recognizable as ${raw}, rounded soft PVC commercial advertising inflatable, broad printed food details, centered isolated object, transparent background`,
            inpaintPrompt:
                `a large inflatable food replica of ${raw} placed in the marked area, glossy PVC, realistic contact shadow`,
            negative:
                "generic tube, abstract shape, arch, tunnel, mascot if not requested, person, human, costume, multiple food objects, collage, pattern",
        };
    }

    if (
        hasAny(text, [
            "mascota",
            "mascot",
            "personaj",
            "character",
            "animal",
            "robot",
            "dragon",
            "dinozaur",
            "dinosaur",
        ]) ||
        selected.includes("mascota")
    ) {
        return {
            subject: raw,
            type: "inflatable mascot",
            overlayPrompt:
                `ONE SINGLE inflatable mascot representing ${raw}, unmistakably matching the requested subject, rounded soft PVC body, commercial inflatable character, centered isolated object, transparent background`,
            inpaintPrompt:
                `a large inflatable mascot representing ${raw} placed in the marked area, glossy PVC, realistic contact shadow`,
            negative:
                "generic tube, abstract shape, arch, tunnel, burger if not requested, wrong animal, person, real human, wearable costume, multiple objects, collage, pattern",
        };
    }

    return {
        subject: raw,
        type: "custom inflatable object",
        overlayPrompt:
            `ONE SINGLE custom inflatable object representing ${raw}, unmistakably matching the written subject, rounded soft PVC commercial inflatable, centered isolated object, transparent background`,
        inpaintPrompt:
            `a large custom inflatable object representing ${raw} placed in the marked area, glossy PVC, realistic contact shadow`,
        negative:
            "generic tube, abstract shape, wrong object, person, human, costume, multiple objects, collage, pattern, unrelated inflatable",
    };
}

function buildOverlayPrompt(options: {
    intent: ResolvedIntent;
    material?: string;
    lighting?: string;
    shapeDetail: number;
    dimensions?: RequestBody["dimensions"];
}) {
    const heightM = clamp(Number(options.dimensions?.heightM ?? 3), 0.5, 20);
    const widthM = clamp(Number(options.dimensions?.widthM ?? 3), 0.5, 20);
    const depthM = clamp(Number(options.dimensions?.depthM ?? 1.2), 0.2, 10);

    return `
${options.intent.overlayPrompt}.

Material: ${getMaterialText(options.material)}.
Lighting: ${getLightingText(options.lighting)}.
Form detail: ${getDetailText(options.shapeDetail)}.
Approximate proportions: height ${heightM.toFixed(1)}m, width ${widthM.toFixed(1)}m, depth ${depthM.toFixed(1)}m.

CRITICAL RULES:
Generate exactly one single object.
The object must match this subject: ${options.intent.subject}.
The object must be recognizable as: ${options.intent.type}.
Transparent background only.
No scene.
No floor.
No building.
No people.
No repeated objects.
No collage.
No pattern.
No image sheet.
No rectangular background.
No generic inflatable tube unless the subject itself is a tube.
No unrelated object.
Complete object, not cropped.
Commercial inflatable PVC construction.
`.trim();
}

function buildOverlayNegativePrompt(intent: ResolvedIntent) {
    return `
${intent.negative},
wrong subject,
unrelated object,
generic inflatable,
generic blue tube,
abstract inflatable,
inflatable hook,
letter shape,
number shape,
question mark shape,
arch if not requested,
tunnel if not requested,
person,
human,
man,
woman,
child,
face,
mask,
helmet,
wearable costume,
real person in costume,
mannequin,
multiple objects,
two objects,
many objects,
repeated objects,
pattern,
tile,
tiled image,
collage,
grid,
poster,
product sheet,
sprite sheet,
background,
white background,
black background,
colored background,
rectangular patch,
image patch,
scene,
floor,
ground,
building,
street,
trees,
cars,
watermark,
text,
bad transparent edge,
cropped object,
cut off object,
deformed subject,
unrecognizable subject
`.trim();
}

function buildInpaintPrompt(options: {
    intent: ResolvedIntent;
    material?: string;
    lighting?: string;
    shapeDetail: number;
    placementMode?: string;
    dimensions?: RequestBody["dimensions"];
}) {
    const heightM = clamp(Number(options.dimensions?.heightM ?? 3), 0.5, 20);
    const widthM = clamp(Number(options.dimensions?.widthM ?? 3), 0.5, 20);
    const depthM = clamp(Number(options.dimensions?.depthM ?? 1.2), 0.2, 10);

    return `
Edit only the white masked area of the original photograph.
Insert ${options.intent.inpaintPrompt}.
The generated inflatable must match this exact subject: ${options.intent.subject}.
The generated inflatable must be recognizable as: ${options.intent.type}.
Placement mode: ${options.placementMode || "Pe sol"}.
Approximate dimensions: height ${heightM.toFixed(1)}m, width ${widthM.toFixed(1)}m, depth ${depthM.toFixed(1)}m.
Material: ${getMaterialText(options.material)}.
Lighting: match the original photo and ${getLightingText(options.lighting)}.
Form detail: ${getDetailText(options.shapeDetail)}.

Rules:
Preserve the original image outside the mask.
Do not alter the building, windows, pavement, vegetation or background outside the mask.
The object must physically touch the target surface unless suspended.
Add realistic contact shadow.
Match camera perspective.
No people.
No costume.
No unrelated object.
`.trim();
}

function buildInpaintNegativePrompt(intent: ResolvedIntent) {
    return `
${intent.negative},
wrong subject,
unrelated object,
person,
human,
man,
woman,
child,
wearable costume,
mannequin,
multiple objects,
collage,
pattern,
generic tube,
abstract shape,
changed background,
changed building,
changed windows,
changed pavement,
distorted facade,
floating object,
no contact shadow,
bad perspective,
watermark,
text
`.trim();
}

async function generateOverlayImage(options: {
    stabilityKey: string;
    finalPrompt: string;
    negativePrompt: string;
}) {
    const formData = new FormData();
    formData.append("prompt", options.finalPrompt);
    formData.append("negative_prompt", options.negativePrompt);
    formData.append("output_format", "png");
    formData.append("aspect_ratio", "1:1");

    const generateResponse = await fetch(
        "https://api.stability.ai/v2beta/stable-image/generate/core",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${options.stabilityKey}`,
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
                Authorization: `Bearer ${options.stabilityKey}`,
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
    const imageBlob = base64ToBlob(options.sceneImage, "image/jpeg");
    const maskBlob = base64ToBlob(options.maskImage, "image/png");

    const formData = new FormData();
    formData.append("image", imageBlob, "scene.jpg");
    formData.append("mask", maskBlob, "mask.png");
    formData.append("prompt", options.finalPrompt);
    formData.append("negative_prompt", options.negativePrompt);
    formData.append("output_format", "png");

    const response = await fetch(
        "https://api.stability.ai/v2beta/stable-image/edit/inpaint",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${options.stabilityKey}`,
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
            userPrompt = "",
            prompt = "",
            productType = "Custom",
            selectedUiProductType = "",
            placementMode = "Pe sol",
            renderPipeline,
            generateMode = "photo",
            dimensions,
            material = "PVC lucios",
            lighting = "Zi",
            shapeDetail = 35,
            placement,
            adjustments,
        } = body;

        const stabilityKey = process.env.STABILITY_API_KEY;

        if (!stabilityKey) {
            return NextResponse.json(
                { error: "Lipsește STABILITY_API_KEY în Vercel." },
                { status: 400 }
            );
        }

        const cleanPrompt = cleanSubject(userPrompt || prompt || "custom inflatable object");
        const intent = resolveIntent(cleanPrompt, productType);
        const shapeDetailValue = clamp(Number(shapeDetail), 0, 100);

        const pipeline: RenderPipeline =
            renderPipeline || (generateMode === "replica" ? "inpaint" : "overlay");

        if (pipeline === "inpaint") {
            if (!sceneImage) {
                return NextResponse.json(
                    { error: "Pentru inpaint lipsește sceneImage." },
                    { status: 400 }
                );
            }

            if (!maskImage) {
                return NextResponse.json(
                    { error: "Pentru inpaint lipsește maskImage." },
                    { status: 400 }
                );
            }

            const finalPrompt = buildInpaintPrompt({
                intent,
                material,
                lighting,
                shapeDetail: shapeDetailValue,
                placementMode,
                dimensions,
            });

            const negativePrompt = buildInpaintNegativePrompt(intent);

            const result = await generateInpaintImage({
                stabilityKey,
                sceneImage,
                maskImage,
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
                    resolvedSubject: intent.subject,
                    resolvedType: intent.type,
                    originalProductType: productType,
                    selectedUiProductType,
                    placementMode,
                    generateMode,
                    material,
                    lighting,
                    shapeDetail: shapeDetailValue,
                    dimensions,
                    placement,
                    adjustments,
                },
            });
        }

        const finalPrompt = buildOverlayPrompt({
            intent,
            material,
            lighting,
            shapeDetail: shapeDetailValue,
            dimensions,
        });

        const negativePrompt = buildOverlayNegativePrompt(intent);

        const overlayResult = await generateOverlayImage({
            stabilityKey,
            finalPrompt,
            negativePrompt,
        });

        return NextResponse.json({
            overlayUrl: overlayResult.overlayUrl,
            warning: overlayResult.warning,
            prompt: finalPrompt,
            negativePrompt,
            debug: {
                pipeline,
                resolvedSubject: intent.subject,
                resolvedType: intent.type,
                originalProductType: productType,
                selectedUiProductType,
                placementMode,
                generateMode,
                material,
                lighting,
                shapeDetail: shapeDetailValue,
                dimensions,
                placement,
                adjustments,
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
