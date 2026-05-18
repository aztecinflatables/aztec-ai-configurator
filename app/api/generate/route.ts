//
import { NextResponse } from "next/server";
import sharp from "sharp";

export const maxDuration = 60; // Timp maxim de execuție pe Vercel

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { image, desc, tip, pozitie, dimensiune, complexitate, material, iluminare, mediu, maskX, maskY } = body;
        const stabilityKey = process.env.STABILITY_API_KEY;

        if (!stabilityKey) {
            return NextResponse.json({ error: "Lipsește cheia STABILITY_API_KEY" }, { status: 400 });
        }

        const imageBuffer = Buffer.from(image, 'base64');
        const metadata = await sharp(imageBuffer).metadata();
        const width = metadata.width || 1024;
        const height = metadata.height || 1024;

        let processedImageBuffer = imageBuffer; 
        let isNight = mediu === "Noapte";
        let isGlowing = iluminare.includes("Interior") && material.includes("Translucid");

        //
        if (isNight) {
            processedImageBuffer = await sharp(imageBuffer)
                .modulate({ brightness: 0.3, saturation: 0.8 })
                .toBuffer();
        }

        // 1. MASCĂ "TIGHT-FIT" CALCULATĂ LA MILIMETRU (Protejarea fundalului)
        const clickX = Math.round((maskX / 100) * width);
        const clickY = Math.round((maskY / 100) * height);
        
        // Calibrăm dimensiunea pentru un pinguin înalt (ex: 5 metri)
        const sizePercent = Math.max(0.15, Math.min(dimensiune / 10, 0.55)); 
        let desc_en = (desc || "object").toLowerCase();
        
        let objHeight = Math.round(height * sizePercent);
        let objWidth = Math.round(objHeight * 0.7); // Strâns, perfect pentru pinguin
        
        // REPARAȚIE LOGICĂ: Pinguinul e înalt, nu lat. Codul anterior a greșit logic.
        if (desc_en.includes('burg') || tip === "Machetă Produs") {
             // Mască lată doar pentru burger
             objHeight = Math.round(height * sizePercent);
             objWidth = Math.round(objHeight * 1.3);
        } else if (desc_en.includes('pinguin') || tip === "Mascotă 3D") {
             // Mască înaltă și strânsă pentru pinguin
             objHeight = Math.round(height * sizePercent * 1.25);
             objWidth = Math.round(objHeight * 0.55);
        }
        
        const radiusX = Math.round(objWidth / 2);
        const radiusY = Math.round(objHeight / 2);

        let mask = sharp({
            create: {
                width: width, height: height, channels: 3,
                background: { r: 0, g: 0, b: 0 }
            }
        });

        // Baza elipsei pică perfect pe click-ul tău de mouse
        const ellipseCenterY = clickY - radiusY + 5; 
        
        // Blur redus drastic (stdDeviation="5") ca să nu "prindă" fundalul lateral
        const svgShape = Buffer.from(`
            <svg width="${width}" height="${height}">
                <defs>
                    <filter id="blurFilter" x="-10%" y="-10%" width="120%" height="120%">
                        <feGaussianBlur stdDeviation="5" />
                    </filter>
                </defs>
                <ellipse cx="${clickX}" cy="${ellipseCenterY}" rx="${radiusX}" ry="${radiusY}" fill="white" filter="url(#blurFilter)" />
            </svg>
        `);
        
        mask = mask.composite([{ input: svgShape, blend: 'add' }]);
        const maskBuffer = await mask.png().toBuffer();

        // 2. PROMPT STRICT PENTRU SUPRAFAȚĂ NETEDĂ FĂRĂ NODURI
        let wrinklePower = Number(complexitate) || 30;

        let startPrompt = `A HIGH-END COMMERCIAL PHOTOREALISTIC 3D inflatable ${tip} replica of ONE SINGLE ${desc_en}.`;
        
        let matPrompt = `Made of heavy-duty glossy PVC plastic skin, highly detailed fotorealistic printed surface textures flawlessly mapped onto the smooth volume.`;
        let lightPrompt = "Cinematic studio lighting matching the environment perfectly.";

        if (isGlowing) {
            startPrompt = `A POWERFUL INCANDESCENT, INTENSELY LUMINOUS GIANT 3D inflatable ${tip} replica of ONE SINGLE ${desc_en}.`;
            matPrompt = "Made of altamente translucent glowing PVC plastic skin, emitting strong radiant internal LED light.";
            lightPrompt = "GLOWING INTENSELY, RADIANT, casting radiant internal light spill and reflections on the surrounding ground and architecture.";
        }

        if (isNight) {
            lightPrompt += " The scene is dark pitch-black nighttime, with deep shadows.";
        } else {
            lightPrompt += " Placed in clear daytime sunlight.";
        }

        let structureGuide = "The physical shape is a perfectly smooth continuous pneumatic dome structure dummy, clean and seamless. strictly NO knots, stems, or added structures on the top apex.";
        let structureNegGuide = "Ensure massive contact shadows at the base anchor on the ground. Geometry MUST match chosen structure: Pe sol. absolutely NO knots, stems, or added structures on top.";
        
        let finalPrompt = "";
        
        if (wrinklePower <= 35) {
            finalPrompt = `${startPrompt} ${matPrompt} ${structureGuide}. Printed graphics flawless mapped. minimal seams. ${structureNegGuide} ${lightPrompt}. The background architecture and surroundings MUST remain exactly the same. Do not add windows, walls, or fences.`;
        } else {
            let detailed = wrinklePower > 70 ? "hyper realistic extreme detailed physical folds, high pressure tension lines" : "realistic welded PVC air seams, tension wrinkles";
            finalPrompt = `${startPrompt} ${detailed}. ${matPrompt} ${structureGuide}. Printed details mapped. ${structureNegGuide} ${lightPrompt}. The background MUST remain exactly the same. Do not add any structures.`;
        }

        // 3. NEGATIVE PROMPT BLINDAT ÎMPOTRIVA MOTURILOR ȘI ELIPSELOR FANTOMATICE
        let negPrompt = "balloon knot, top knot, balloon stem, stalk, top node, phantom ellipse, ghostly halo, halo structure, pedestal, base, box, stand, altering architecture, changing background, adding walls, redrawing windows, text, watermark, flying, hovering, multiple objects, cartoon, drawing";

        // 4. API CALL
        const formData = new FormData();
        formData.append('image', new Blob([processedImageBuffer], { type: 'image/jpeg' }), 'image.jpg');
        formData.append('mask', new Blob([maskBuffer], { type: 'image/png' }), 'mask.png');
        formData.append('prompt', finalPrompt);
        formData.append('negative_prompt', negPrompt);
        formData.append('output_format', 'png');

        const genResponse = await fetch("https://api.stability.ai/v2beta/stable-image/edit/inpaint", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${stabilityKey}`, 'Accept': 'application/json' },
            body: formData
        });

        if (!genResponse.ok) {
            const errorDetails = await genResponse.text();
            throw new Error(`API Stability a refuzat generarea: ${errorDetails}`);
        }
        
        const genData = await genResponse.json();
        
        return NextResponse.json({ 
            finalImageUrl: `data:image/png;base64,${genData.image || genData.base64}`
        });

    } catch (error: any) {
        console.error("Eroare Backend:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
