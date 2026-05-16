import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60;

type GenerateMode = "rapid" | "photo" | "replica";

type RequestBody = {
    sceneImage?: string;
    refImage?: string | null;
    textureImage?: string | null;
    prompt?: string;
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
};

function base64ToBlob(base64: string, type = "image/jpeg") {
    const buffer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return new Blob([buffer], { type });
}

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function getModePrompt(mode: GenerateMode, respectReference: number) {
    if (mode === "replica" || respectReference >= 80) {
        return `
STRICT REPLICA MODE.
The reference image is the source of truth.
Preserve the exact inflatable product geometry, silhouette, proportions, panel layout and visual identity as much as possible.
Do not redesign the object.
Do not reinterpret the object.
Do not invent a different structure.
`.trim();
    }

    if (mode === "photo") {
        return `
PHOTOREALISTIC MODE.
Create a realistic commercial visualization while keeping the product believable and manufacturable.
Use the reference as strong guidance, but allow minor improvements for realism and presentation.
`.trim();
    }

    return `
FAST MOCKUP MODE.
Create a clean concept mockup quickly.
The result may be more simplified, but must still look like a professional inflatable product.
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

    const strictness =
        respectReference >= 85
            ? "very strict"
            : respectReference >= 60
              ? "strong"
              : respectReference >= 30
                ? "medium"
                : "loose";

    let prompt = `
Reference priority: ${respectReference}/100 (${strictness}).
`.trim();

    if (hasRefImage) {
        prompt += `

Use the reference image as the primary design source.`;

        if (respectShape) {
            prompt += `
- Preserve the reference shape, silhouette, inflatable structure and topology.`;
        }

        if (respectProportions) {
            prompt += `
- Preserve the reference proportions and relative dimensions.`;
        }

        if (respectTexture) {
            prompt += `
- Preserve the printed texture, color blocks, pattern layout and surface graphics from the reference.`;
        }

        if (respectBranding) {
            prompt += `
- Preserve visible branding placement and print layout from the reference image as closely as possible.`;
        }

        if (respectReference >= 85) {
            prompt += `
- Do not replace the reference object with a generic inflatable.
- Do not simplify the object into a different design.
- Do not change the silhouette.
- Do not change the print layout unless required by transparency cleanup.`;
        }
    } else {
        prompt += `

No product reference image was provided. Generate from the user description and settings.`;
    }

    if (hasTextureImage) {
        prompt += `

A separate texture/branding image was provided.
Apply that uploaded texture/branding to the inflatable surface while keeping the product form stable and realistic.
If both reference and texture are provided: keep the reference shape, but prioritize the uploaded texture/branding for surface appearance.`;
    }

    return prompt.trim();
}

function getMaterialPrompt(material: string, lighting: string) {
    let prompt = "";

    if (material === "PVC lucios") {
        prompt += `
Material: glossy inflatable PVC, soft specular highlights, welded seams, flexible pressurized surface.`;
    } else if (material === "PVC mat") {
        prompt += `
Material: matte inflatable PVC, soft diffused reflections, welded seams, professional outdoor fabric look.`;
    } else if (material === "Alb translucid") {
        prompt += `
Material: white translucent inflatable PVC, subtle light diffusion, soft semi-transparent material response.`;
    } else if (material === "LED interior") {
        prompt += `
Material: translucent internally illuminated inflatable PVC, visible soft glow, realistic internal LED diffusion.`;
    } else if (material === "Outdoor heavy-duty") {
        prompt += `
Material: heavy-duty outdoor inflatable PVC, durable fabric texture, reinforced welded seams, robust commercial construction.`;
    } else {
        prompt += `
Material: realistic commercial inflatable PVC.`;
    }

    if (lighting === "Noapte") {
        prompt += `
Lighting: nighttime environment compatibility, stronger highlights, believable shadows and glow where applicable.`;
    } else if (lighting === "Golden hour") {
        prompt += `
Lighting: warm golden-hour commercial photography, soft long shadows, warm highlights.`;
    } else if (lighting === "Interior") {
        prompt += `
Lighting: controlled indoor lighting, soft realistic shadows, product presentation look.`;
    } else {
        prompt += `
Lighting: natural daylight, realistic outdoor highlights and shadows.`;
    }

    return prompt.trim();
}

function getRealismPrompt(realism: number) {
    if (realism >= 80) {
        return `
Inflatable realism: high.
Show realistic welded seams, slight PVC wrinkles, air pressure tension, subtle panel deformation, soft rounded inflated edges, believable commercial fabrication details.
The object must look manufacturable by an inflatable production company.
`.trim();
    }

    if (realism >= 45) {
        return `
Inflatable realism: medium.
Show clean seams, mild wrinkles and a professional product visualization style.
`.trim();
    }

    return `
Inflatable realism: clean CGI.
Smooth, simple, polished commercial mockup with minimal wrinkles.
`.trim();
}

function getDimensionsPrompt(dimensions: RequestBody["dimensions"]) {
    const widthM = dimensions?.widthM ?? 6;
    const heightM = dimensions?.heightM ?? 4;
    const depthM = dimensions?.depthM ?? 1.2;
    const autoScale = dimensions?.autoScale ?? true;

    return `
Target real-world gabarit:
Width: ${widthM} meters.
Height: ${heightM} meters.
Depth: ${depthM} meters.
Respect these proportions visually.

Auto-scale from scene: ${autoScale ? "enabled" : "disabled"}.
The generated object should look plausible at this physical size.
`.trim();
}

function getNegativePrompt(mode: GenerateMode, respectReference: number) {
    let negative = `
generic unrelated object,
wrong object,
different shape,
changed silhouette,
floating object,
cut off object,
cropped object,
bad transparent edges,
extra background,
white background,
black background,
street background,
people,
cars,
trees,
buildings,
text artifacts,
random letters,
watermark,
low resolution,
blurry,
plastic toy,
paper,
cardboard,
metal sculpture,
rigid hard object,
deflated bag,
messy folds,
melted geometry,
distorted perspective
`.trim();

    if (mode === "replica" || respectReference >= 80) {
        negative += `,
redesigned product,
creative reinterpretation,
generic arch,
generic tent,
incorrect branding layout,
incorrect pattern,
missing reference details`;
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
Analyze this inflatable product reference image.

Return strict JSON only:
{
  "object_type": "short English object type",
  "shape_description": "short exact geometry/silhouette description",
  "texture_description": "short description of colors, printed graphics, patterns and branding layout",
  "proportions": "short proportions description",
  "manufacturing_notes": "short notes about seams, inflatable tubes, panels"
}

No markdown.
No explanations outside JSON.
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
            prompt = "professional inflatable advertising object",
            generateMode = "replica",
            referenceControl,
            dimensions,
            material = "PVC lucios",
            lighting = "Zi",
            realism = 80,
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
            Number(referenceControl?.respectReference ?? 85),
            0,
            100
        );

        const respectShape = referenceControl?.respectShape ?? true;
        const respectTexture = referenceControl?.respectTexture ?? true;
        const respectProportions = referenceControl?.respectProportions ?? true;
        const respectBranding = referenceControl?.respectBranding ?? true;

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

        const materialPrompt = getMaterialPrompt(material, lighting);
        const realismPrompt = getRealismPrompt(clamp(Number(realism), 0, 100));
        const dimensionsPrompt = getDimensionsPrompt(dimensions);
        const negativePrompt = getNegativePrompt(generateMode, respectReference);

        const geminiPrompt = geminiAnalysis
            ? `
Reference analysis:
Object type: ${geminiAnalysis.object_type}
Shape: ${geminiAnalysis.shape_description}
Texture / print: ${geminiAnalysis.texture_description}
Proportions: ${geminiAnalysis.proportions}
Manufacturing notes: ${geminiAnalysis.manufacturing_notes}
`
            : "";

        const finalPrompt = `
Create a high-quality transparent PNG overlay of a commercial inflatable product.

USER REQUEST:
${prompt}

${modePrompt}

${referencePrompt}

${geminiPrompt}

${dimensionsPrompt}

${materialPrompt}

${realismPrompt}

COMPOSITING REQUIREMENTS:
- Generate only the inflatable object as a clean PNG overlay.
- Transparent background.
- The object must be complete, not cropped.
- The base of the object must visually sit on a ground or mounting surface when composited.
- Correct commercial product scale.
- Correct perspective for placement in a real scene.
- No people.
- No environment.
- No extra props.
- No watermark.
- No random text artifacts.
- Use realistic inflatable PVC construction.
`.trim();

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
                    ? "0.38"
                    : respectReference >= 75
                      ? "0.48"
                      : respectReference >= 55
                        ? "0.60"
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
                generateMode,
                respectReference,
                respectShape,
                respectTexture,
                respectProportions,
                respectBranding,
                material,
                lighting,
                realism,
                dimensions,
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
