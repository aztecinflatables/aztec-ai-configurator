import { NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";

type RenderStyle = "mockup" | "photorealism";
type Placement = "ground" | "roof" | "wall";
type Lighting = "day" | "night";

type GenerateRequest = {
  sceneImage: string;
  referenceImage?: string | null;
  logoImage?: string | null;
  maskImage: string;
  prompt: string;
  category: string;
  detectedType: string;
  placement: Placement;
  renderStyle: RenderStyle;
  targetHeightM: number;
  detailPercent: number;
  respectPercent: number;
  respectShape: boolean;
  respectTexture: boolean;
  respectProportions: boolean;
  respectBranding: boolean;
  material: string;
  lighting: Lighting;
  positionX: number;
  positionY: number;
  scalePercent: number;
  rotationDeg: number;
};

function dataUrlToParts(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid data URL");
  }
  return {
    mime: match[1],
    base64: match[2],
  };
}

function dataUrlToBuffer(dataUrl: string): Buffer {
  const { base64 } = dataUrlToParts(dataUrl);
  return Buffer.from(base64, "base64");
}

function bufferToDataUrl(buffer: Buffer, mime = "image/png") {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function pickFilename(mime: string, base: string) {
  if (mime.includes("png")) return `${base}.png`;
  if (mime.includes("webp")) return `${base}.webp`;
  return `${base}.jpg`;
}

function dataUrlToBlob(dataUrl: string, baseName: string) {
  const { mime } = dataUrlToParts(dataUrl);
  const buffer = dataUrlToBuffer(dataUrl);
  return {
    blob: new Blob([buffer], { type: mime }),
    filename: pickFilename(mime, baseName),
  };
}

function normalizePromptText(text: string) {
  return (text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveSubjectLabel(prompt: string, detectedType: string, category: string) {
  const text = `${prompt} ${detectedType} ${category}`.toLowerCase();

  if (text.includes("burger") || text.includes("hamburger")) return "hamburger inflatable";
  if (text.includes("penguin") || text.includes("pinguin")) return "penguin inflatable mascot";
  if (text.includes("dog") || text.includes("catel") || text.includes("câine")) return "dog inflatable mascot";
  if (text.includes("arch") || text.includes("arcad")) return "inflatable arch";
  if (text.includes("tunnel") || text.includes("tunel")) return "inflatable tunnel";
  if (text.includes("dome") || text.includes("cupol")) return "inflatable dome";
  if (text.includes("tent") || text.includes("cort")) return "inflatable tent";
  if (text.includes("glass") || text.includes("sticl")) return "transparent inflatable structure";
  if (text.includes("mask")) return "inflatable mask";
  if (text.includes("food") || detectedType.toLowerCase().includes("food")) return "inflatable food replica";
  if (detectedType.toLowerCase().includes("mascot")) return "inflatable mascot";
  if (category.toLowerCase().includes("arc")) return "inflatable arch";

  return "inflatable object";
}

function buildDetailInstruction(subjectLabel: string, detailPercent: number, renderStyle: RenderStyle) {
  if (detailPercent <= 20) {
    return [
      `Keep the form simplified but still immediately recognizable as a ${subjectLabel}.`,
      `Use large rounded volumes, minimal segmentation, minimal external complexity, and very subtle inflatable creases.`,
      `Do NOT reduce it to a flat front icon or a weird abstract blob.`,
      renderStyle === "mockup"
        ? `Preserve a readable 3D perspective with clean inflated shape.`
        : `Preserve a realistic 3D inflated shape with simplified outer form.`,
    ].join(" ");
  }

  if (detailPercent <= 50) {
    return [
      `Use a medium level of form detail.`,
      `Keep the shape recognizable and inflated, with moderate simplification of smaller features.`,
      `Creases and seams should stay subtle.`,
    ].join(" ");
  }

  return [
    `Use a high level of recognizable form detail while keeping the object clearly inflatable.`,
    `Do not overdo wrinkles; keep seams and creases believable and restrained.`,
  ].join(" ");
}

function buildPlacementInstruction(placement: Placement) {
  if (placement === "roof") {
    return `Place the inflatable on the roof / top of the building, fully supported and physically plausible.`;
  }
  if (placement === "wall") {
    return `Place the inflatable attached to or emerging from the wall / facade area in a physically plausible way.`;
  }
  return `Place the inflatable on the ground plane. The base/support of the object must sit exactly on the selected marker point.`;
}

function buildLightingInstruction(lighting: Lighting, material: string) {
  const materialBlock =
    material === "pvc-matte"
      ? "Use matte PVC inflatable material."
      : material === "white-translucent"
      ? "Use white translucent inflatable material."
      : material === "led-interior"
      ? "Use an inflatable material that can glow from interior LED lighting."
      : "Use glossy PVC inflatable material.";

  if (lighting === "night") {
    return `${materialBlock} Match a night environment: darker scene, realistic night exposure, believable shadows and highlights, and if appropriate a subtle internal glow only when material suggests it.`;
  }

  return `${materialBlock} Match the current daytime environment with believable daylight, highlights, contact shadows, and realistic integration.`;
}

function buildRespectInstruction(input: GenerateRequest) {
  const parts: string[] = [];
  if (input.referenceImage) {
    parts.push(`A product reference image is provided.`);
  }
  if (input.logoImage) {
    parts.push(`A logo / print / texture reference is provided.`);
  }

  if (input.respectShape) parts.push(`Respect the reference shape as much as possible.`);
  if (input.respectTexture) parts.push(`Respect the reference texture / material as much as possible.`);
  if (input.respectProportions) parts.push(`Respect the reference proportions as much as possible.`);
  if (input.respectBranding) parts.push(`Respect the reference branding / print placement as much as possible.`);

  parts.push(`Overall reference fidelity target is about ${input.respectPercent}%.`);

  return parts.join(" ");
}

function buildStyleInstruction(renderStyle: RenderStyle) {
  if (renderStyle === "mockup") {
    return [
      `Generate a realistic inflatable mockup integrated into the scene.`,
      `This MUST look like a perspective 3D mockup, not a flat orthographic front view and not a sticker pasted on the image.`,
      `Use a clear 3/4 perspective when the object allows it, consistent with the camera perspective of the scene.`,
      `Keep it visually clean, readable, and commercially useful.`,
    ].join(" ");
  }

  return [
    `Generate a photorealistic inflatable object seamlessly integrated into the scene.`,
    `It must look like a real photographed inflatable present in the location, with correct perspective, contact shadow, cast shadow, lighting, and material response.`,
  ].join(" ");
}

function buildPrompt(input: GenerateRequest) {
  const subjectLabel = resolveSubjectLabel(input.prompt, input.detectedType, input.category);
  const cleanedPrompt = normalizePromptText(input.prompt);
  const effectiveHeight =
    input.renderStyle === "photorealism"
      ? input.targetHeightM * 3
      : input.targetHeightM;

  const subjectBlock = cleanedPrompt
    ? `Requested subject / concept: "${cleanedPrompt}". Interpret this as a ${subjectLabel}.`
    : `Create a ${subjectLabel}.`;

  const prompt = [
    `Image A is the location / scene photo and is the direct edit target.`,
    input.referenceImage
      ? `Image B is the product / subject reference image.`
      : ``,
    input.referenceImage && input.logoImage
      ? `Image C is the logo / print / texture reference image.`
      : !input.referenceImage && input.logoImage
      ? `Image B is the logo / print / texture reference image.`
      : ``,
    `Edit the scene photo by placing exactly ONE inflatable object in the masked area only.`,
    `Preserve the entire background scene outside the masked area.`,
    subjectBlock,
    buildStyleInstruction(input.renderStyle),
    buildRespectInstruction(input),
    buildPlacementInstruction(input.placement),
    buildLightingInstruction(input.lighting, input.material),
    buildDetailInstruction(subjectLabel, input.detailPercent, input.renderStyle),
    `The selected marker is the exact anchor point. The generated object must be positioned exactly there with no extra offset.`,
    `Marker coordinates are approximately X ${input.positionX.toFixed(1)}%, Y ${input.positionY.toFixed(1)}% of the image.`,
    `Requested target height is ${input.targetHeightM.toFixed(1)} meters.`,
    `For ${input.renderStyle === "photorealism" ? "FOTOREALISM" : "MOCKUP"} generation, use effective scale guidance of about ${effectiveHeight.toFixed(1)} meters as requested by the user.`,
    `Use visual clues in the scene such as doors, windows, fence, sign, walls, and ground plane to infer believable size and perspective.`,
    `The object must feel correctly dimensioned relative to the architecture; do not make it arbitrarily tiny or huge.`,
    `Make the object clearly readable and recognizable. Do not generate an unrelated object.`,
    `Produce believable contact shadow and cast shadow on the ground / nearby surfaces whenever physically appropriate.`,
    `Do not generate extra people, extra props, or multiple copies of the object.`,
  ]
    .filter(Boolean)
    .join(" ");

  return prompt;
}

async function maybeAdjustSceneForLighting(sceneDataUrl: string, lighting: Lighting) {
  const originalBuffer = dataUrlToBuffer(sceneDataUrl);

  if (lighting !== "night") {
    return bufferToDataUrl(originalBuffer);
  }

  const nightBuffer = await sharp(originalBuffer)
    .modulate({
      brightness: 0.38,
      saturation: 0.78,
    })
    .tint({ r: 170, g: 185, b: 220 })
    .png()
    .toBuffer();

  return bufferToDataUrl(Buffer.from(nightBuffer), "image/png");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GenerateRequest;

    if (!body.sceneImage) {
      return NextResponse.json({ error: "Missing scene image." }, { status: 400 });
    }

    if (!body.maskImage) {
      return NextResponse.json({ error: "Missing mask image." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY environment variable." },
        { status: 500 }
      );
    }

    const prompt = buildPrompt(body);
    const adjustedSceneDataUrl = await maybeAdjustSceneForLighting(
      body.sceneImage,
      body.lighting
    );

    const sceneFile = dataUrlToBlob(adjustedSceneDataUrl, "scene");
    const maskFile = dataUrlToBlob(body.maskImage, "mask");
    const referenceFile = body.referenceImage
      ? dataUrlToBlob(body.referenceImage, "reference")
      : null;
    const logoFile = body.logoImage
      ? dataUrlToBlob(body.logoImage, "logo")
      : null;

    const form = new FormData();

    form.append("model", "gpt-image-1");
    form.append("prompt", prompt);
    form.append("size", "1536x1536");
    form.append("quality", "high");
    form.append("image[]", sceneFile.blob, sceneFile.filename);
    form.append("mask", maskFile.blob, maskFile.filename);

    if (referenceFile) {
      form.append("image[]", referenceFile.blob, referenceFile.filename);
    }

    if (logoFile) {
      form.append("image[]", logoFile.blob, logoFile.filename);
    }

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: form,
    });

    const json = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            json?.error?.message ||
            json?.message ||
            "Image generation failed.",
          debugPrompt: prompt,
        },
        { status: response.status }
      );
    }

    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json(
        {
          error: "No image returned from API.",
          raw: json,
          debugPrompt: prompt,
        },
        { status: 500 }
      );
    }

    const outputDataUrl = `data:image/png;base64,${b64}`;

    return NextResponse.json({
      imageDataUrl: outputDataUrl,
      debugPrompt: prompt,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}
