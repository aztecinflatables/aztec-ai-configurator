import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const { image, refImage, desc, pozitie, complexitate } = body;

        const stabilityKey = process.env.STABILITY_API_KEY;
        const googleKey = process.env.GOOGLE_GENAI_API_KEY;

        if (!stabilityKey) {
            return NextResponse.json(
                { error: "Lipsește STABILITY_API_KEY" },
                { status: 400 }
            );
        }

        let desc_en = desc || "inflatable object";

        let cameraAngle =
            "eye-level camera angle, standing on the ground, straight on";

        if (
            pozitie === "Pe clădire" ||
            pozitie === "Peste clădire" ||
            pozitie === "În aer"
        ) {
            cameraAngle =
                "viewed from below, low angle shot, looking up at the object";
        }

        let lightStr = "bright studio product lighting";
        let mat_en = "glossy PVC";

        let wrinklePower = Number(complexitate) || 30;

        let finalPrompt = "";
        let negPrompt =
            "text, watermark, logo, blurry, low quality, messy background";

        if (wrinklePower <= 35) {
            finalPrompt = `A smooth inflatable ${desc_en}, perfectly clean glossy PVC, minimal wrinkles, soft rounded edges, highly stylized, product style. Camera: ${cameraAngle}. Lighting: ${lightStr}.`;
        } else if (wrinklePower <= 70) {
            finalPrompt = `A realistic inflatable ${desc_en}, soft shape, visible seams, subtle folds, realistic material, printed texture. Camera: ${cameraAngle}. Lighting: ${lightStr}.`;
        } else {
            finalPrompt = `A hyper realistic giant inflatable ${desc_en}, complex geometry, deep folds, strong seams, real tension fabric, photorealistic. Camera: ${cameraAngle}. Lighting: ${lightStr}.`;
        }

        const formData = new FormData();
        formData.append("prompt", finalPrompt);
        formData.append("negative_prompt", negPrompt);
        formData.append("output_format", "png");

        if (refImage) {
            const buffer = Uint8Array.from(
                atob(refImage),
                (c) => c.charCodeAt(0)
            );
            const blob = new Blob([buffer], { type: "image/jpeg" });

            formData.append("image", blob, "ref.jpg");
            formData.append("mode", "image-to-image");
            formData.append("strength", "0.65");
        }

        const response = await fetch(
            "https://api.stability.ai/v2beta/stable-image/generate/core",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${stabilityKey}`,
                    Accept: "application/json"
                },
                body: formData
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { error: data.message || "Eroare Stability" },
                { status: 400 }
            );
        }

        if (!data.image) {
            return NextResponse.json(
                { error: "Nu a fost returnată imagine" },
                { status: 500 }
            );
        }

        const removeBgForm = new FormData();

        const buffer = Uint8Array.from(
            atob(data.image),
            (c) => c.charCodeAt(0)
        );
        const blob = new Blob([buffer], { type: "image/png" });

        removeBgForm.append("image", blob, "image.png");
        removeBgForm.append("output_format", "png");

        const bgRes = await fetch(
            "https://api.stability.ai/v2beta/stable-image/edit/remove-background",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${stabilityKey}`,
                    Accept: "application/json"
                },
                body: removeBgForm
            }
        );

        const bgData = await bgRes.json();

        return NextResponse.json({
            overlayUrl: `data:image/png;base64,${
                bgData.image || bgData.base64
            }`
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
