"use client";

import { useRef, useState } from "react";

type GenerateMode = "rapid" | "photo" | "replica";

type MaterialMode =
    | "PVC lucios"
    | "PVC mat"
    | "Alb translucid"
    | "LED interior"
    | "Outdoor heavy-duty";

type ProductType =
    | "Arcadă"
    | "Mascotă"
    | "Cupolă"
    | "Cort"
    | "Tunel"
    | "Sticlă"
    | "Custom";

type PlacementMode =
    | "Pe sol"
    | "Pe acoperiș"
    | "Pe fațadă"
    | "Suspendat"
    | "În interior";

const PRODUCT_PRESETS: Record<ProductType, string> = {
    Arcadă:
        "Arcadă gonflabilă publicitară premium, cu două picioare verticale stabile și traversă superioară rotunjită, proporții realiste, PVC lucios, construcție fabricabilă.",
    Mascotă:
        "Mascotă gonflabilă mare, volum rotunjit, expresivă, stabilă, realizabilă în PVC gonflabil, formă simplificată dar recognoscibilă.",
    Cupolă:
        "Cupolă gonflabilă pentru eveniment, volum mare rotunjit, structură stabilă, material PVC rezistent outdoor, aspect premium.",
    Cort:
        "Cort gonflabil pentru eveniment, structură tubulară gonflabilă, acoperiș moale, proporții realiste, aspect premium.",
    Tunel:
        "Tunel gonflabil mare pentru evenimente sportive, structură lungă, intrare rotunjită, PVC lucios, stabil pe sol.",
    Sticlă:
        "Replică gonflabilă de produs în formă de sticlă, proporții recognoscibile, volum moale, PVC lucios, fabricabilă.",
    Custom:
        "Obiect gonflabil personalizat, realist, fabricabil, cu formă stabilă, material PVC profesional și proporții comerciale.",
};

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function normalizeText(value: string) {
    return value
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

function cleanUserPrompt(value: string) {
    return value
        .replace(/pe acoperiș/gi, "")
        .replace(/pe acoperis/gi, "")
        .replace(/peste clădire/gi, "")
        .replace(/peste cladire/gi, "")
        .replace(/pe clădire/gi, "")
        .replace(/pe cladire/gi, "")
        .replace(/pe sol/gi, "")
        .replace(/pe fațadă/gi, "")
        .replace(/pe fatada/gi, "")
        .replace(/suspendat/gi, "")
        .replace(/\s+/g, " ")
        .replace(/\s+,/g, ",")
        .replace(/,+/g, ",")
        .trim();
}

function getDerivedDimensions(productType: ProductType, heightM: number) {
    if (productType === "Arcadă") return { widthM: heightM * 1.25, depthM: heightM * 0.25 };
    if (productType === "Mascotă") return { widthM: heightM * 0.9, depthM: heightM * 0.55 };
    if (productType === "Cupolă") return { widthM: heightM * 1.8, depthM: heightM * 1.8 };
    if (productType === "Cort") return { widthM: heightM * 1.5, depthM: heightM * 1.5 };
    if (productType === "Tunel") return { widthM: heightM * 1.1, depthM: heightM * 2.2 };
    if (productType === "Sticlă") return { widthM: heightM * 0.35, depthM: heightM * 0.35 };
    return { widthM: heightM, depthM: heightM * 0.5 };
}

function getDefaultShadowSettings(placementMode: PlacementMode) {
    if (placementMode === "Pe fațadă") {
        return { x: 4, y: 4, scaleX: 78, scaleY: 62, blur: 18, opacity: 32, skew: 0 };
    }

    if (placementMode === "Suspendat") {
        return { x: 0, y: 24, scaleX: 70, scaleY: 12, blur: 24, opacity: 20, skew: 0 };
    }

    if (placementMode === "Pe acoperiș") {
        return { x: 4, y: 2, scaleX: 86, scaleY: 16, blur: 18, opacity: 34, skew: -8 };
    }

    if (placementMode === "În interior") {
        return { x: 2, y: 3, scaleX: 82, scaleY: 15, blur: 16, opacity: 28, skew: 0 };
    }

    return { x: 3, y: 2, scaleX: 84, scaleY: 15, blur: 16, opacity: 36, skew: -6 };
}

function getObjectFilter(lighting: string, material: MaterialMode) {
    if (lighting === "Noapte") {
        if (material === "LED interior" || material === "Alb translucid") {
            return "brightness(0.92) contrast(1.08) saturate(1.18) drop-shadow(0 0 18px rgba(255,230,170,0.42)) drop-shadow(0 0 38px rgba(255,150,40,0.26))";
        }

        return "brightness(0.72) contrast(1.12) saturate(0.9) drop-shadow(0 0 12px rgba(120,170,255,0.16))";
    }

    if (lighting === "Golden hour") {
        return "brightness(1.04) contrast(1.05) saturate(1.12) sepia(0.15) hue-rotate(-7deg) drop-shadow(10px 16px 18px rgba(0,0,0,0.22))";
    }

    if (lighting === "Interior") {
        return "brightness(0.96) contrast(1.03) saturate(0.92) drop-shadow(0 12px 18px rgba(0,0,0,0.20))";
    }

    return "brightness(1) contrast(1.03) saturate(1.04) drop-shadow(0 10px 16px rgba(0,0,0,0.16))";
}

function roundedRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
) {
    const r = Math.min(radius, width / 2, height / 2);

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function getInpaintWorkAreaAspect(productType: ProductType, prompt: string, shapeDetail: number) {
    const text = normalizeText(prompt);
    const detail = clamp(shapeDetail / 100, 0, 1);

    if (
        text.includes("burger") ||
        text.includes("hamburger") ||
        text.includes("pizza") ||
        text.includes("sandwich") ||
        text.includes("hotdog") ||
        text.includes("donut") ||
        text.includes("gogoasa")
    ) {
        return {
            width: 1.35,
            height: 0.72 + detail * 0.18,
            roundness: 0.34,
        };
    }

    if (
        text.includes("pinguin") ||
        text.includes("penguin") ||
        text.includes("catel") ||
        text.includes("caine") ||
        text.includes("dog") ||
        text.includes("pisica") ||
        text.includes("cat") ||
        text.includes("urs") ||
        text.includes("bear") ||
        text.includes("mascota") ||
        text.includes("animal")
    ) {
        return {
            width: 0.82,
            height: 1.22,
            roundness: 0.28,
        };
    }

    if (productType === "Arcadă") return { width: 1.35, height: 1.08, roundness: 0.16 };
    if (productType === "Tunel") return { width: 1.28, height: 0.98, roundness: 0.18 };
    if (productType === "Cort") return { width: 1.32, height: 0.92, roundness: 0.18 };
    if (productType === "Cupolă") return { width: 1.22, height: 0.82, roundness: 0.36 };
    if (productType === "Sticlă") return { width: 0.56, height: 1.45, roundness: 0.2 };
    if (productType === "Mascotă") return { width: 0.82, height: 1.22, roundness: 0.28 };

    return { width: 0.95, height: 0.95, roundness: 0.28 };
}

function makeProceduralInflatableSvgDataUrl(options: {
    prompt: string;
    productType: ProductType;
    material: MaterialMode;
    lighting: string;
    shapeDetail: number;
}) {
    const prompt = normalizeText(options.prompt);
    const isBurger = prompt.includes("burger") || prompt.includes("hamburger");
    const ledGlow = options.material === "LED interior" || options.material === "Alb translucid";
    const night = options.lighting === "Noapte";
    const warm = options.lighting === "Golden hour";
    const detailT = clamp(options.shapeDetail / 10, 0, 1);

    const bgGlow = ledGlow
        ? `<ellipse cx="512" cy="418" rx="430" ry="230" fill="rgba(255,215,125,0.22)" filter="url(#blurGlow)" />`
        : "";

    const glossyOpacity = options.material === "PVC mat" ? 0.14 : 0.28;
    const seamOpacity = options.material === "PVC mat" ? 0.18 : 0.24;
    const globalBrightness = night ? 0.78 : warm ? 1.05 : 1;

    let body = "";

    if (isBurger) {
        body = `
            <g filter="url(#softShadow)">
                <ellipse cx="512" cy="540" rx="370" ry="${170 + detailT * 18}" fill="url(#burgerBody)" />
                <ellipse cx="512" cy="535" rx="365" ry="${165 + detailT * 15}" fill="url(#surfaceGloss)" opacity="${glossyOpacity}" />
                <ellipse cx="512" cy="540" rx="370" ry="${170 + detailT * 18}" fill="none" stroke="rgba(255,255,255,${seamOpacity})" stroke-width="6" />
                <ellipse cx="512" cy="470" rx="305" ry="82" fill="rgba(255,227,165,0.60)" />
                <rect x="220" y="520" width="584" height="26" rx="13" fill="#c34f42" opacity="0.95" />
                <rect x="210" y="554" width="604" height="20" rx="10" fill="#8db83c" opacity="0.96" />
                <rect x="225" y="585" width="574" height="28" rx="14" fill="#654128" opacity="0.96" />
                <rect x="240" y="624" width="544" height="20" rx="10" fill="#cda32f" opacity="0.95" />
                <path d="M248 435 C365 376 660 376 774 435" stroke="rgba(255,255,255,0.28)" stroke-width="18" stroke-linecap="round" fill="none" />
            </g>
        `;
    } else {
        body = `
            <g filter="url(#softShadow)">
                <ellipse cx="512" cy="540" rx="360" ry="195" fill="url(#genericBase)" />
                <ellipse cx="512" cy="536" rx="356" ry="191" fill="url(#surfaceGloss)" opacity="${glossyOpacity}" />
                <ellipse cx="512" cy="540" rx="360" ry="195" fill="none" stroke="rgba(255,255,255,${seamOpacity})" stroke-width="6" />
                <path d="M240 415 C348 360 676 360 784 415" stroke="rgba(255,255,255,0.28)" stroke-width="20" stroke-linecap="round" fill="none" />
            </g>
        `;
    }

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs>
        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="rgba(0,0,0,0.22)" />
        </filter>

        <filter id="blurGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="35" />
        </filter>

        <radialGradient id="genericBase" cx="38%" cy="28%" r="75%">
            <stop offset="0%" stop-color="${ledGlow ? "#fff2c9" : "#f5f5f5"}" />
            <stop offset="45%" stop-color="${ledGlow ? "#ffd980" : "#ff7a18"}" />
            <stop offset="100%" stop-color="${ledGlow ? "#c98518" : "#b84300"}" />
        </radialGradient>

        <radialGradient id="burgerBody" cx="38%" cy="26%" r="78%">
            <stop offset="0%" stop-color="#f5dcb5" />
            <stop offset="36%" stop-color="#e4b165" />
            <stop offset="100%" stop-color="#b86a28" />
        </radialGradient>

        <radialGradient id="surfaceGloss" cx="34%" cy="18%" r="68%">
            <stop offset="0%" stop-color="rgba(255,255,255,0.80)" />
            <stop offset="28%" stop-color="rgba(255,255,255,0.22)" />
            <stop offset="72%" stop-color="rgba(255,255,255,0.04)" />
            <stop offset="100%" stop-color="rgba(255,255,255,0)" />
        </radialGradient>
    </defs>

    <g opacity="${globalBrightness}">
        ${bgGlow}
        ${body}
    </g>
</svg>
`.trim();

    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

export default function Page() {
    const [sceneImage, setSceneImage] = useState<string | null>(null);
    const [sceneBase64, setSceneBase64] = useState<string | null>(null);
    const [sceneNatural, setSceneNatural] = useState({ width: 1, height: 1 });

    const [refImage, setRefImage] = useState<string | null>(null);
    const [textureImage, setTextureImage] = useState<string | null>(null);

    const [userPrompt, setUserPrompt] = useState("burger");
    const [selectedProductType, setSelectedProductType] = useState<ProductType>("Mascotă");
    const [placementMode, setPlacementMode] = useState<PlacementMode>("Pe sol");

    const [generateMode, setGenerateMode] = useState<GenerateMode>("photo");

    const [respectReference, setRespectReference] = useState(85);
    const [respectShape, setRespectShape] = useState(true);
    const [respectTexture, setRespectTexture] = useState(true);
    const [respectProportions, setRespectProportions] = useState(true);
    const [respectBranding, setRespectBranding] = useState(true);

    const [heightM, setHeightM] = useState(3);
    const derived = getDerivedDimensions(selectedProductType, heightM);

    const [material, setMaterial] = useState<MaterialMode>("PVC lucios");
    const [lighting, setLighting] = useState("Zi");

    const [shapeDetail, setShapeDetail] = useState(15);

    const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
    const [resultSceneUrl, setResultSceneUrl] = useState<string | null>(null);
    const [maskDebugUrl, setMaskDebugUrl] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [posX, setPosX] = useState(58);
    const [posY, setPosY] = useState(92);
    const [overlayScale, setOverlayScale] = useState(32);
    const [inpaintAreaScale, setInpaintAreaScale] = useState(118);
    const [rotation, setRotation] = useState(0);

    const defaultShadow = getDefaultShadowSettings(placementMode);
    const [shadowX, setShadowX] = useState(defaultShadow.x);
    const [shadowY, setShadowY] = useState(defaultShadow.y);
    const [shadowScaleX, setShadowScaleX] = useState(defaultShadow.scaleX);
    const [shadowScaleY, setShadowScaleY] = useState(defaultShadow.scaleY);
    const [shadowBlur, setShadowBlur] = useState(defaultShadow.blur);
    const [shadowOpacity, setShadowOpacity] = useState(defaultShadow.opacity);
    const [shadowSkew, setShadowSkew] = useState(defaultShadow.skew);

    const [objectBrightness, setObjectBrightness] = useState(100);
    const [objectContrast, setObjectContrast] = useState(100);
    const [objectWarmth, setObjectWarmth] = useState(0);
    const [objectOpacity, setObjectOpacity] = useState(100);

    const previewRef = useRef<HTMLDivElement | null>(null);

    const subjectPrompt = cleanUserPrompt(userPrompt) || userPrompt.trim();
    const fullPrompt = `${subjectPrompt}. ${PRODUCT_PRESETS[selectedProductType]}`;
    const displayedScene = resultSceneUrl || sceneImage;

    const objectFilter = `
        ${getObjectFilter(lighting, material)}
        brightness(${objectBrightness}%)
        contrast(${objectContrast}%)
        sepia(${Math.max(0, objectWarmth) / 100})
        hue-rotate(${objectWarmth < 0 ? objectWarmth : -objectWarmth * 0.12}deg)
    `;

    const clearResults = () => {
        setOverlayUrl(null);
        setResultSceneUrl(null);
        setMaskDebugUrl(null);
        setError(null);
    };

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
                const result = reader.result as string;
                resolve(result.split(",")[1]);
            };

            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const resetShadowForPlacement = (mode: PlacementMode) => {
        const next = getDefaultShadowSettings(mode);

        setShadowX(next.x);
        setShadowY(next.y);
        setShadowScaleX(next.scaleX);
        setShadowScaleY(next.scaleY);
        setShadowBlur(next.blur);
        setShadowOpacity(next.opacity);
        setShadowSkew(next.skew);
    };

    const handleSceneUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const base64 = await fileToBase64(file);
        setSceneBase64(base64);
        setSceneImage(`data:${file.type};base64,${base64}`);
        setResultSceneUrl(null);
        setOverlayUrl(null);
        setMaskDebugUrl(null);
        setError(null);
    };

    const handleRefUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const base64 = await fileToBase64(file);
        setRefImage(base64);
        clearResults();
    };

    const handleTextureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const base64 = await fileToBase64(file);
        setTextureImage(base64);
        clearResults();
    };

    const getContainedImageRect = () => {
        const stage = previewRef.current;
        if (!stage) return null;

        const rect = stage.getBoundingClientRect();
        const stageRatio = rect.width / rect.height;
        const imageRatio = sceneNatural.width / sceneNatural.height;

        let renderWidth = rect.width;
        let renderHeight = rect.height;
        let offsetX = 0;
        let offsetY = 0;

        if (imageRatio > stageRatio) {
            renderWidth = rect.width;
            renderHeight = rect.width / imageRatio;
            offsetY = (rect.height - renderHeight) / 2;
        } else {
            renderHeight = rect.height;
            renderWidth = rect.height * imageRatio;
            offsetX = (rect.width - renderWidth) / 2;
        }

        return {
            stageRect: rect,
            imageLeft: offsetX,
            imageTop: offsetY,
            imageWidth: renderWidth,
            imageHeight: renderHeight,
        };
    };

    const buildMaskBase64 = () => {
        const metrics = getContainedImageRect();
        if (!metrics || !sceneNatural.width || !sceneNatural.height) return null;

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(sceneNatural.width));
        canvas.height = Math.max(1, Math.round(sceneNatural.height));

        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const anchorStageX = (posX / 100) * metrics.stageRect.width;
        const anchorStageY = (posY / 100) * metrics.stageRect.height;

        const imageX = ((anchorStageX - metrics.imageLeft) / metrics.imageWidth) * canvas.width;
        const imageY = ((anchorStageY - metrics.imageTop) / metrics.imageHeight) * canvas.height;

        const displayedObjectWidthPx = (overlayScale / 100) * metrics.imageWidth;
        const objectWidthInImagePx = (displayedObjectWidthPx / metrics.imageWidth) * canvas.width;

        const areaMultiplier = inpaintAreaScale / 100;
        const aspect = getInpaintWorkAreaAspect(selectedProductType, subjectPrompt, shapeDetail);

        const minMaskWidth = canvas.width * 0.045;
        const maxMaskWidth = canvas.width * 0.45;
        const minMaskHeight = canvas.height * 0.045;
        const maxMaskHeight = canvas.height * 0.45;

        const workWidth = clamp(
            objectWidthInImagePx * aspect.width * areaMultiplier,
            minMaskWidth,
            maxMaskWidth
        );

        const workHeight = clamp(
            objectWidthInImagePx * aspect.height * areaMultiplier,
            minMaskHeight,
            maxMaskHeight
        );

        const contactSpace = clamp(workHeight * 0.16, 12, canvas.height * 0.045);
        const sideSpace = clamp(workWidth * 0.045, 6, canvas.width * 0.025);

        const finalW = clamp(workWidth + sideSpace * 2, minMaskWidth, maxMaskWidth);
        const finalH = clamp(workHeight + contactSpace, minMaskHeight, maxMaskHeight);

        let x = imageX - finalW / 2;
        let y = imageY - finalH + contactSpace * 0.62;

        if (placementMode === "Suspendat") {
            y = imageY - finalH / 2;
        }

        if (placementMode === "Pe fațadă") {
            y = imageY - finalH / 2;
        }

        x = clamp(x, 0, canvas.width - finalW);
        y = clamp(y, 0, canvas.height - finalH);

        ctx.save();
        ctx.translate(imageX, imageY);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-imageX, -imageY);

        ctx.fillStyle = "white";

        if (placementMode === "Suspendat") {
            ctx.beginPath();
            ctx.ellipse(
                x + finalW / 2,
                y + finalH / 2,
                finalW * 0.5,
                finalH * 0.48,
                0,
                0,
                Math.PI * 2
            );
            ctx.fill();
        } else if (placementMode === "Pe fațadă") {
            roundedRectPath(ctx, x, y, finalW, finalH, Math.min(finalW, finalH) * 0.18);
            ctx.fill();
        } else {
            roundedRectPath(ctx, x, y, finalW, finalH, Math.min(finalW, finalH) * aspect.roundness);
            ctx.fill();

            ctx.beginPath();
            ctx.ellipse(
                imageX,
                clamp(imageY + contactSpace * 0.14, 0, canvas.height),
                finalW * 0.38,
                contactSpace * 0.46,
                0,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }

        ctx.restore();

        const dataUrl = canvas.toDataURL("image/png");
        setMaskDebugUrl(dataUrl);

        return dataUrl.split(",")[1];
    };

    const handlePreviewClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (!previewRef.current || !sceneImage || loading) return;

        const imageRect = getContainedImageRect();
        if (!imageRect) return;

        const stageRect = imageRect.stageRect;
        const clickX = event.clientX - stageRect.left;
        const clickY = event.clientY - stageRect.top;

        const clampedX = Math.max(
            imageRect.imageLeft,
            Math.min(imageRect.imageLeft + imageRect.imageWidth, clickX)
        );

        const clampedY = Math.max(
            imageRect.imageTop,
            Math.min(imageRect.imageTop + imageRect.imageHeight, clickY)
        );

        const x = (clampedX / stageRect.width) * 100;
        const y = (clampedY / stageRect.height) * 100;

        setPosX(clamp(x, 0, 100));
        setPosY(clamp(y, 0, 180));
        clearResults();
    };

    const handleGenerate = async () => {
        if (!sceneBase64) {
            setError("Încarcă mai întâi imaginea locației.");
            return;
        }

        setLoading(true);
        setError(null);
        setOverlayUrl(null);
        setResultSceneUrl(null);

        try {
            const proceduralMode = generateMode === "rapid" && shapeDetail <= 10;

            if (proceduralMode) {
                const proceduralUrl = makeProceduralInflatableSvgDataUrl({
                    prompt: subjectPrompt,
                    productType: selectedProductType,
                    material,
                    lighting,
                    shapeDetail,
                });

                setOverlayUrl(proceduralUrl);
                setLoading(false);
                return;
            }

            const maskBase64 = buildMaskBase64();

            if (!maskBase64) {
                throw new Error("Nu am putut genera masca pentru inpaint.");
            }

            const response = await fetch("/api/generate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    sceneImage: sceneBase64,
                    refImage,
                    textureImage,
                    maskImage: maskBase64,
                    prompt: fullPrompt,
                    userPrompt: subjectPrompt,
                    productPreset: PRODUCT_PRESETS[selectedProductType],
                    productType: selectedProductType,
                    placementMode,
                    generateMode,
                    renderPipeline: generateMode === "rapid" ? "overlay" : "inpaint",
                    referenceControl: {
                        respectReference,
                        respectShape,
                        respectTexture,
                        respectProportions,
                        respectBranding,
                    },
                    dimensions: {
                        widthM: derived.widthM,
                        heightM,
                        depthM: derived.depthM,
                        autoScale: false,
                    },
                    material,
                    lighting,
                    shapeDetail,
                    placement: {
                        x: posX,
                        y: posY,
                        anchor: "base-center",
                    },
                    adjustments: {
                        scalePercent: overlayScale,
                        inpaintAreaScale,
                        rotationDeg: rotation,
                        shadowX,
                        shadowY,
                        shadowScaleX,
                        shadowScaleY,
                        shadowBlur,
                        shadowOpacity,
                        shadowSkew,
                        objectBrightness,
                        objectContrast,
                        objectWarmth,
                        objectOpacity,
                    },
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Eroare la generare.");
            }

            if (data.compositedUrl || data.resultSceneUrl || data.finalImageUrl) {
                setResultSceneUrl(data.compositedUrl || data.resultSceneUrl || data.finalImageUrl);
                setOverlayUrl(null);
            } else if (data.overlayUrl) {
                setOverlayUrl(data.overlayUrl);
                setResultSceneUrl(null);
            } else {
                throw new Error("API-ul nu a returnat un rezultat valid.");
            }
        } catch (err: any) {
            setError(err.message || "Eroare necunoscută.");
        }

        setLoading(false);
    };

    return (
        <div className="aztec-grid">
            <aside className="aztec-left-panel">
                <div className="aztec-tabs">
                    <button className="aztec-tab aztec-tab-active" type="button">
                        CLIENT
                    </button>
                    <button className="aztec-tab" type="button">
                        ADMIN
                    </button>
                </div>

                <div className="aztec-title">CONFIGURARE AI</div>
                <div className="aztec-separator" />

                <div className="aztec-sections">
                    <section className="aztec-section">
                        <div className="aztec-section-button aztec-section-button-active">
                            1. IMAGINI
                        </div>

                        <div className="aztec-section-content">
                            <div className="aztec-section-line" />

                            <div className="aztec-label">Imagine locație</div>
                            <input
                                className="aztec-input aztec-file-input"
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={handleSceneUpload}
                            />

                            <div className="aztec-label" style={{ marginTop: 14 }}>
                                Imagine referință produs
                            </div>
                            <input
                                className="aztec-input aztec-file-input"
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={handleRefUpload}
                            />

                            <div className="aztec-label" style={{ marginTop: 14 }}>
                                Logo / print / textură custom
                            </div>
                            <input
                                className="aztec-input aztec-file-input"
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={handleTextureUpload}
                            />
                        </div>
                    </section>

                    <section className="aztec-section">
                        <div className="aztec-section-button aztec-section-button-active">
                            2. CE VREI SĂ GENEREZI?
                        </div>

                        <div className="aztec-section-content">
                            <div className="aztec-section-line" />

                            <div className="aztec-label">Descriere scurtă</div>
                            <textarea
                                className="aztec-textarea"
                                value={userPrompt}
                                onChange={(e) => {
                                    setUserPrompt(e.target.value);
                                    clearResults();
                                }}
                                placeholder="Ex: burger, arcadă AZTEC, mascotă urs, sticlă de suc..."
                            />

                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                                {(
                                    [
                                        "Arcadă",
                                        "Mascotă",
                                        "Cupolă",
                                        "Cort",
                                        "Tunel",
                                        "Sticlă",
                                        "Custom",
                                    ] as ProductType[]
                                ).map((chip) => {
                                    const active = selectedProductType === chip;

                                    return (
                                        <button
                                            key={chip}
                                            type="button"
                                            onClick={() => {
                                                setSelectedProductType(chip);
                                                clearResults();
                                            }}
                                            style={{
                                                border: active
                                                    ? "1px solid rgba(255,106,0,0.95)"
                                                    : "1px solid rgba(255,255,255,0.1)",
                                                background: active
                                                    ? "#FF6A00"
                                                    : "rgba(255,255,255,0.04)",
                                                color: "white",
                                                borderRadius: 999,
                                                padding: "8px 12px",
                                                cursor: "pointer",
                                                fontWeight: 800,
                                                fontSize: 12,
                                                boxShadow: active
                                                    ? "0 8px 18px rgba(255,106,0,0.25)"
                                                    : "none",
                                            }}
                                        >
                                            {chip}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="aztec-label" style={{ marginTop: 14 }}>
                                Poziționare
                            </div>

                            <select
                                className="aztec-select"
                                value={placementMode}
                                onChange={(e) => {
                                    const next = e.target.value as PlacementMode;
                                    setPlacementMode(next);
                                    resetShadowForPlacement(next);
                                    clearResults();
                                }}
                            >
                                <option>Pe sol</option>
                                <option>Pe acoperiș</option>
                                <option>Pe fațadă</option>
                                <option>Suspendat</option>
                                <option>În interior</option>
                            </select>
                        </div>
                    </section>

                    <section className="aztec-section">
                        <div className="aztec-section-button aztec-section-button-active">
                            3. STIL GENERARE
                        </div>

                        <div className="aztec-section-content">
                            <div className="aztec-section-line" />

                            <div className="aztec-two-cols">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setGenerateMode("rapid");
                                        clearResults();
                                    }}
                                    className={
                                        generateMode === "rapid"
                                            ? "aztec-tab aztec-tab-active"
                                            : "aztec-tab"
                                    }
                                >
                                    MOCKUP
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setGenerateMode("photo");
                                        clearResults();
                                    }}
                                    className={
                                        generateMode === "photo"
                                            ? "aztec-tab aztec-tab-active"
                                            : "aztec-tab"
                                    }
                                >
                                    FOTO
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    setGenerateMode("replica");
                                    clearResults();
                                }}
                                className={
                                    generateMode === "replica"
                                        ? "aztec-tab aztec-tab-active"
                                        : "aztec-tab"
                                }
                                style={{ width: "100%", marginTop: 10 }}
                            >
                                REPLICĂ EXACTĂ
                            </button>
                        </div>
                    </section>

                    <section className="aztec-section">
                        <div className="aztec-section-button aztec-section-button-active">
                            4. CONTROL REFERINȚĂ
                        </div>

                        <div className="aztec-section-content">
                            <div className="aztec-section-line" />

                            <div className="aztec-slider-header">
                                <div className="aztec-label">Respectă referința</div>
                                <div className="aztec-slider-value">{respectReference}%</div>
                            </div>

                            <input
                                className="aztec-slider"
                                type="range"
                                min={0}
                                max={100}
                                value={respectReference}
                                onChange={(e) => {
                                    setRespectReference(Number(e.target.value));
                                    clearResults();
                                }}
                            />

                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 1fr",
                                    gap: 10,
                                    marginTop: 14,
                                }}
                            >
                                <label className="aztec-checkbox-row">
                                    <input
                                        className="aztec-checkbox"
                                        type="checkbox"
                                        checked={respectShape}
                                        onChange={(e) => {
                                            setRespectShape(e.target.checked);
                                            clearResults();
                                        }}
                                    />
                                    Forma
                                </label>

                                <label className="aztec-checkbox-row">
                                    <input
                                        className="aztec-checkbox"
                                        type="checkbox"
                                        checked={respectTexture}
                                        onChange={(e) => {
                                            setRespectTexture(e.target.checked);
                                            clearResults();
                                        }}
                                    />
                                    Textura
                                </label>

                                <label className="aztec-checkbox-row">
                                    <input
                                        className="aztec-checkbox"
                                        type="checkbox"
                                        checked={respectProportions}
                                        onChange={(e) => {
                                            setRespectProportions(e.target.checked);
                                            clearResults();
                                        }}
                                    />
                                    Proporții
                                </label>

                                <label className="aztec-checkbox-row">
                                    <input
                                        className="aztec-checkbox"
                                        type="checkbox"
                                        checked={respectBranding}
                                        onChange={(e) => {
                                            setRespectBranding(e.target.checked);
                                            clearResults();
                                        }}
                                    />
                                    Branding
                                </label>
                            </div>
                        </div>
                    </section>

                    <section className="aztec-section">
                        <div className="aztec-section-button aztec-section-button-active">
                            5. GABARIT
                        </div>

                        <div className="aztec-section-content">
                            <div className="aztec-section-line" />

                            <div className="aztec-slider-header">
                                <div className="aztec-label">Înălțime țintă</div>
                                <div className="aztec-slider-value">{heightM.toFixed(1)} m</div>
                            </div>

                            <input
                                className="aztec-slider"
                                type="range"
                                min={0.5}
                                max={12}
                                step={0.1}
                                value={heightM}
                                onChange={(e) => {
                                    setHeightM(Number(e.target.value));
                                    clearResults();
                                }}
                            />

                            <div className="aztec-info-box" style={{ marginTop: 12 }}>
                                Dimensiuni estimate:
                                <br />
                                <strong style={{ color: "#FFFFFF" }}>
                                    Înălțime: {heightM.toFixed(1)} m
                                    <br />
                                    Lățime: {derived.widthM.toFixed(1)} m
                                    <br />
                                    Lungime / adâncime: {derived.depthM.toFixed(1)} m
                                </strong>
                            </div>
                        </div>
                    </section>

                    <section className="aztec-section">
                        <div className="aztec-section-button aztec-section-button-active">
                            6. MATERIAL & LUMINĂ
                        </div>

                        <div className="aztec-section-content">
                            <div className="aztec-section-line" />

                            <div className="aztec-label">Material</div>
                            <select
                                className="aztec-select"
                                value={material}
                                onChange={(e) => {
                                    setMaterial(e.target.value as MaterialMode);
                                    clearResults();
                                }}
                            >
                                <option>PVC lucios</option>
                                <option>PVC mat</option>
                                <option>Alb translucid</option>
                                <option>LED interior</option>
                                <option>Outdoor heavy-duty</option>
                            </select>

                            <div className="aztec-label" style={{ marginTop: 12 }}>
                                Lumină / mediu
                            </div>
                            <select
                                className="aztec-select"
                                value={lighting}
                                onChange={(e) => {
                                    setLighting(e.target.value);
                                    clearResults();

                                    if (e.target.value === "Noapte") {
                                        setObjectBrightness(78);
                                        setObjectContrast(112);
                                        setObjectWarmth(-10);
                                        setShadowOpacity(48);
                                        setShadowBlur(22);
                                    } else if (e.target.value === "Golden hour") {
                                        setObjectBrightness(104);
                                        setObjectContrast(106);
                                        setObjectWarmth(30);
                                        setShadowOpacity(36);
                                        setShadowBlur(18);
                                    } else if (e.target.value === "Interior") {
                                        setObjectBrightness(94);
                                        setObjectContrast(102);
                                        setObjectWarmth(5);
                                        setShadowOpacity(30);
                                        setShadowBlur(18);
                                    } else {
                                        setObjectBrightness(100);
                                        setObjectContrast(100);
                                        setObjectWarmth(0);
                                        setShadowOpacity(36);
                                        setShadowBlur(16);
                                    }
                                }}
                            >
                                <option>Zi</option>
                                <option>Golden hour</option>
                                <option>Noapte</option>
                                <option>Interior</option>
                            </select>
                        </div>
                    </section>

                    <section className="aztec-section">
                        <div className="aztec-section-button aztec-section-button-active">
                            7. AJUSTARE MOCKUP
                        </div>

                        <div className="aztec-section-content">
                            <div className="aztec-section-line" />

                            <div className="aztec-slider-header">
                                <div className="aztec-label">Poziție X</div>
                                <div className="aztec-slider-value">{posX.toFixed(1)}%</div>
                            </div>

                            <input
                                className="aztec-slider"
                                type="range"
                                min={0}
                                max={100}
                                step={0.1}
                                value={posX}
                                onChange={(e) => {
                                    setPosX(Number(e.target.value));
                                    clearResults();
                                }}
                            />

                            <div className="aztec-slider-header" style={{ marginTop: 14 }}>
                                <div className="aztec-label">Poziție Y</div>
                                <div className="aztec-slider-value">{posY.toFixed(1)}%</div>
                            </div>

                            <input
                                className="aztec-slider"
                                type="range"
                                min={0}
                                max={180}
                                step={0.1}
                                value={posY}
                                onChange={(e) => {
                                    setPosY(Number(e.target.value));
                                    clearResults();
                                }}
                            />

                            <div className="aztec-slider-header" style={{ marginTop: 14 }}>
                                <div className="aztec-label">Scală pe imagine</div>
                                <div className="aztec-slider-value">{overlayScale}%</div>
                            </div>

                            <input
                                className="aztec-slider"
                                type="range"
                                min={5}
                                max={120}
                                value={overlayScale}
                                onChange={(e) => {
                                    setOverlayScale(Number(e.target.value));
                                    clearResults();
                                }}
                            />

                            <div className="aztec-slider-header" style={{ marginTop: 14 }}>
                                <div className="aztec-label">Mărime zonă inpaint</div>
                                <div className="aztec-slider-value">{inpaintAreaScale}%</div>
                            </div>

                            <input
                                className="aztec-slider"
                                type="range"
                                min={80}
                                max={180}
                                value={inpaintAreaScale}
                                onChange={(e) => {
                                    setInpaintAreaScale(Number(e.target.value));
                                    clearResults();
                                }}
                            />

                            <div className="aztec-slider-header" style={{ marginTop: 14 }}>
                                <div className="aztec-label">Rotație</div>
                                <div className="aztec-slider-value">{rotation}°</div>
                            </div>

                            <input
                                className="aztec-slider"
                                type="range"
                                min={-30}
                                max={30}
                                value={rotation}
                                onChange={(e) => {
                                    setRotation(Number(e.target.value));
                                    clearResults();
                                }}
                            />

                            <div className="aztec-slider-header" style={{ marginTop: 14 }}>
                                <div className="aztec-label">Detaliu formă</div>
                                <div className="aztec-slider-value">{shapeDetail}%</div>
                            </div>

                            <input
                                className="aztec-slider"
                                type="range"
                                min={0}
                                max={100}
                                value={shapeDetail}
                                onChange={(e) => {
                                    setShapeDetail(Number(e.target.value));
                                    clearResults();
                                }}
                            />

                            <div className="aztec-info-box" style={{ marginTop: 12 }}>
                                Scală pe imagine controlează mărimea obiectului. Mărime zonă inpaint
                                controlează cât spațiu primește AI-ul pentru obiect, contact și umbră.
                                Recomandat: Scală 28–35%, zonă inpaint 110–130%.
                            </div>
                        </div>
                    </section>

                    <section className="aztec-section">
                        <div className="aztec-section-button aztec-section-button-active">
                            8. UMBRĂ & INTEGRARE
                        </div>

                        <div className="aztec-section-content">
                            <div className="aztec-section-line" />

                            {[
                                ["Umbră X", shadowX, setShadowX, -40, 40, "%"],
                                ["Umbră Y", shadowY, setShadowY, -40, 60, "%"],
                                ["Lățime umbră", shadowScaleX, setShadowScaleX, 10, 180, "%"],
                                ["Înălțime umbră", shadowScaleY, setShadowScaleY, 2, 100, "%"],
                                ["Blur umbră", shadowBlur, setShadowBlur, 0, 50, "px"],
                                ["Opacitate umbră", shadowOpacity, setShadowOpacity, 0, 90, "%"],
                                ["Skew umbră", shadowSkew, setShadowSkew, -45, 45, "°"],
                                ["Brightness obiect", objectBrightness, setObjectBrightness, 40, 160, "%"],
                                ["Contrast obiect", objectContrast, setObjectContrast, 40, 180, "%"],
                                ["Temperatură obiect", objectWarmth, setObjectWarmth, -60, 80, ""],
                                ["Opacitate obiect", objectOpacity, setObjectOpacity, 10, 100, "%"],
                            ].map(([label, value, setter, min, max, unit]) => (
                                <div key={String(label)} style={{ marginTop: 14 }}>
                                    <div className="aztec-slider-header">
                                        <div className="aztec-label">{label as string}</div>
                                        <div className="aztec-slider-value">
                                            {value as number}
                                            {unit as string}
                                        </div>
                                    </div>
                                    <input
                                        className="aztec-slider"
                                        type="range"
                                        min={min as number}
                                        max={max as number}
                                        value={value as number}
                                        onChange={(e) => {
                                            (
                                                setter as React.Dispatch<
                                                    React.SetStateAction<number>
                                                >
                                            )(Number(e.target.value));
                                            clearResults();
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    </section>

                    {error && <div className="aztec-error-box">{error}</div>}

                    <button
                        className="aztec-generate-button"
                        type="button"
                        onClick={handleGenerate}
                        disabled={loading}
                    >
                        {loading ? "SE GENEREAZĂ..." : "GENEREAZĂ SIMULAREA"}
                    </button>

                    <div
                        style={{
                            textAlign: "center",
                            fontSize: 12,
                            color: "rgba(255,255,255,0.5)",
                        }}
                    >
                        Timp estimativ: 30–60 secunde
                    </div>
                </div>
            </aside>

            <section className="aztec-preview-panel">
                <div
                    ref={previewRef}
                    className={
                        sceneImage
                            ? "aztec-preview-stage aztec-preview-stage-clickable"
                            : "aztec-preview-stage"
                    }
                    onClick={handlePreviewClick}
                >
                    {!displayedScene && (
                        <div className="aztec-preview-placeholder">
                            Încarcă o imagine de locație pentru previzualizare
                        </div>
                    )}

                    {displayedScene && (
                        <img
                            className="aztec-preview-image"
                            src={displayedScene}
                            alt="Scenă"
                            onLoad={(event) => {
                                if (!resultSceneUrl) {
                                    setSceneNatural({
                                        width: event.currentTarget.naturalWidth,
                                        height: event.currentTarget.naturalHeight,
                                    });
                                }
                            }}
                        />
                    )}

                    {loading && (
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                zIndex: 20,
                                background: "rgba(0,0,0,0.38)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                pointerEvents: "none",
                            }}
                        >
                            <div
                                style={{
                                    position: "absolute",
                                    left: `${posX}%`,
                                    top: `${posY}%`,
                                    width: 34,
                                    height: 34,
                                    borderRadius: "50%",
                                    border: "3px solid rgba(255,255,255,0.85)",
                                    borderTopColor: "#FF6A00",
                                    transform: "translate(-50%, -50%)",
                                    animation: "spin 0.8s linear infinite",
                                    boxShadow: "0 0 28px rgba(255,106,0,0.55)",
                                }}
                            />

                            <div
                                style={{
                                    background: "rgba(13,16,22,0.92)",
                                    border: "1px solid rgba(255,255,255,0.14)",
                                    borderRadius: 18,
                                    padding: "18px 22px",
                                    boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
                                    textAlign: "center",
                                    maxWidth: 320,
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 15,
                                        fontWeight: 900,
                                        color: "#FFFFFF",
                                        marginBottom: 6,
                                    }}
                                >
                                    Se generează simularea...
                                </div>
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "rgba(255,255,255,0.62)",
                                        lineHeight: 1.4,
                                    }}
                                >
                                    În mod FOTO / REPLICĂ se trimite zonă compactă
                                    pentru inpaint.
                                </div>
                            </div>
                        </div>
                    )}

                    {overlayUrl && !resultSceneUrl && (
                        <>
                            <div
                                style={{
                                    position: "absolute",
                                    left: `calc(${posX}% + ${shadowX}px)`,
                                    top: `calc(${posY}% + ${shadowY}px)`,
                                    width: `${overlayScale * (shadowScaleX / 100)}%`,
                                    height: `${overlayScale * (shadowScaleY / 100)}%`,
                                    transform: `translate(-50%, -50%) skewX(${shadowSkew}deg)`,
                                    transformOrigin: "50% 50%",
                                    background:
                                        "radial-gradient(ellipse at center, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.42) 34%, rgba(0,0,0,0.16) 58%, rgba(0,0,0,0.04) 76%, rgba(0,0,0,0) 88%)",
                                    filter: `blur(${shadowBlur}px)`,
                                    opacity: shadowOpacity / 100,
                                    zIndex: 2,
                                    pointerEvents: "none",
                                    mixBlendMode: "multiply",
                                }}
                            />

                            <img
                                className="aztec-generated-overlay"
                                src={overlayUrl}
                                alt="Gonflabil generat"
                                style={{
                                    position: "absolute",
                                    left: `${posX}%`,
                                    top: `${posY}%`,
                                    width: `${overlayScale}%`,
                                    transform: `translate(-50%, -100%) rotate(${rotation}deg)`,
                                    transformOrigin: "50% 100%",
                                    zIndex: 3,
                                    pointerEvents: "none",
                                    userSelect: "none",
                                    filter: objectFilter,
                                    opacity: objectOpacity / 100,
                                }}
                            />
                        </>
                    )}

                    {sceneImage && !loading && !resultSceneUrl && !overlayUrl && (
                        <div
                            className="aztec-position-dot"
                            style={{
                                left: `${posX}%`,
                                top: `${posY}%`,
                            }}
                        />
                    )}
                </div>

                <div className="aztec-preview-footer">
                    <span>Click poziție: X {posX.toFixed(1)}%</span>
                    <span>Y {posY.toFixed(1)}%</span>
                </div>

                {maskDebugUrl && (
                    <details style={{ marginTop: 10, color: "white" }}>
                        <summary style={{ cursor: "pointer", opacity: 0.75 }}>
                            Debug mască inpaint
                        </summary>
                        <img
                            src={maskDebugUrl}
                            alt="Mask debug"
                            style={{
                                display: "block",
                                width: "100%",
                                marginTop: 10,
                                borderRadius: 14,
                                border: "1px solid rgba(255,255,255,0.1)",
                            }}
                        />
                    </details>
                )}
            </section>

            <style jsx global>{`
                @keyframes spin {
                    from {
                        rotate: 0deg;
                    }
                    to {
                        rotate: 360deg;
                    }
                }
            `}</style>
        </div>
    );
}
