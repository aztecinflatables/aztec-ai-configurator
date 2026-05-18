"use client";

import { useMemo, useRef, useState } from "react";

type GenerateMode = "rapid" | "replica";

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

type ApiProductType = ProductType | "Replică food" | "Replică produs";

type PlacementMode =
    | "Pe sol"
    | "Pe acoperiș"
    | "Pe fațadă"
    | "Suspendat"
    | "În interior";

type ImageMetrics = {
    stageRect: DOMRect;
    imageLeft: number;
    imageTop: number;
    imageWidth: number;
    imageHeight: number;
};

const PRODUCT_PRESETS: Record<ApiProductType, string> = {
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
    "Replică food":
        "Replică gonflabilă publicitară a unui produs alimentar, recognoscibilă, realizabilă în PVC lucios, formă simplificată, volume rotunjite și zone late imprimate pentru detalii.",
    "Replică produs":
        "Replică gonflabilă de produs, proporții recognoscibile, volum moale, PVC lucios, formă simplificată și fabricabilă.",
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
        .replace(/ţ/g, "t")
        .trim();
}

function containsAny(text: string, terms: string[]) {
    const t = normalizeText(text);
    return terms.some((term) => t.includes(normalizeText(term)));
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

function resolveClientProductType(userPrompt: string, selectedType: ProductType): ApiProductType {
    const prompt = normalizeText(userPrompt);

    if (containsAny(prompt, ["arcada", "arch", "poarta", "portal", "intrare"])) {
        return "Arcadă";
    }

    if (containsAny(prompt, ["tunel", "tunnel"])) {
        return "Tunel";
    }

    if (containsAny(prompt, ["cort", "tent", "pavilion"])) {
        return "Cort";
    }

    if (containsAny(prompt, ["cupola", "dome"])) {
        return "Cupolă";
    }

    if (
        containsAny(prompt, [
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
            "flacon",
            "recipient",
        ])
    ) {
        return "Replică produs";
    }

    if (
        containsAny(prompt, [
            "burger",
            "hamburger",
            "cheeseburger",
            "sandwich",
            "hotdog",
            "hot dog",
            "pizza",
            "cartof",
            "cartofi",
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
        ])
    ) {
        return "Replică food";
    }

    if (
        containsAny(prompt, [
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
            "robot",
            "monstru",
            "monster",
            "animal",
        ])
    ) {
        return "Mascotă";
    }

    return selectedType;
}

function getDerivedDimensions(productType: ApiProductType, heightM: number) {
    if (productType === "Arcadă") return { widthM: heightM * 1.25, depthM: heightM * 0.25 };
    if (productType === "Mascotă") return { widthM: heightM * 0.9, depthM: heightM * 0.55 };
    if (productType === "Cupolă") return { widthM: heightM * 1.8, depthM: heightM * 1.8 };
    if (productType === "Cort") return { widthM: heightM * 1.5, depthM: heightM * 1.5 };
    if (productType === "Tunel") return { widthM: heightM * 1.1, depthM: heightM * 2.2 };
    if (productType === "Sticlă") return { widthM: heightM * 0.35, depthM: heightM * 0.35 };
    if (productType === "Replică produs") return { widthM: heightM * 0.75, depthM: heightM * 0.45 };
    if (productType === "Replică food") return { widthM: heightM * 1.25, depthM: heightM * 0.7 };
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

function getInpaintWorkAreaAspect(productType: ApiProductType, prompt: string, shapeDetail: number) {
    const text = normalizeText(prompt);
    const detail = clamp(shapeDetail / 100, 0.15, 1);

    if (
        productType === "Replică food" ||
        text.includes("burger") ||
        text.includes("hamburger") ||
        text.includes("pizza") ||
        text.includes("sandwich") ||
        text.includes("hotdog") ||
        text.includes("donut") ||
        text.includes("gogoasa")
    ) {
        return {
            width: 1.18,
            height: 0.58 + detail * 0.14,
            roundness: 0.34,
        };
    }

    if (productType === "Mascotă") {
        return {
            width: 0.74,
            height: 1.12,
            roundness: 0.28,
        };
    }

    if (productType === "Arcadă") return { width: 1.28, height: 1.05, roundness: 0.16 };
    if (productType === "Tunel") return { width: 1.25, height: 0.92, roundness: 0.18 };
    if (productType === "Cort") return { width: 1.25, height: 0.88, roundness: 0.18 };
    if (productType === "Cupolă") return { width: 1.15, height: 0.78, roundness: 0.36 };
    if (productType === "Sticlă" || productType === "Replică produs") {
        return { width: 0.52, height: 1.25, roundness: 0.2 };
    }

    return { width: 0.9, height: 0.9, roundness: 0.28 };
}

function getProductVisualAspect(productType: ApiProductType, prompt: string) {
    const text = normalizeText(prompt);

    if (
        productType === "Replică food" ||
        text.includes("burger") ||
        text.includes("hamburger") ||
        text.includes("pizza") ||
        text.includes("sandwich") ||
        text.includes("hotdog")
    ) {
        return {
            widthToHeight: 1.85,
            contactY: 0.78,
        };
    }

    if (productType === "Mascotă") {
        return {
            widthToHeight: 0.82,
            contactY: 0.91,
        };
    }

    if (productType === "Arcadă") {
        return {
            widthToHeight: 1.25,
            contactY: 0.94,
        };
    }

    if (productType === "Tunel") {
        return {
            widthToHeight: 1.55,
            contactY: 0.88,
        };
    }

    if (productType === "Cort") {
        return {
            widthToHeight: 1.5,
            contactY: 0.9,
        };
    }

    if (productType === "Cupolă") {
        return {
            widthToHeight: 1.5,
            contactY: 0.88,
        };
    }

    if (productType === "Sticlă" || productType === "Replică produs") {
        return {
            widthToHeight: 0.42,
            contactY: 0.94,
        };
    }

    return {
        widthToHeight: 1,
        contactY: 0.9,
    };
}

function estimateMetersVisibleInImage(placementMode: PlacementMode) {
    if (placementMode === "Pe acoperiș") return 18;
    if (placementMode === "Pe fațadă") return 14;
    if (placementMode === "Suspendat") return 16;
    if (placementMode === "În interior") return 6;
    return 13.5;
}

function calculateAutoMockupBox(options: {
    productType: ApiProductType;
    prompt: string;
    heightM: number;
    imageMetrics: ImageMetrics | null;
    placementMode: PlacementMode;
    userScalePercent: number;
}) {
    const visual = getProductVisualAspect(options.productType, options.prompt);
    const fallbackImageHeight = 720;
    const imageHeightPx = options.imageMetrics?.imageHeight || fallbackImageHeight;
    const imageWidthPx = options.imageMetrics?.imageWidth || 1280;
    const metersVisible = estimateMetersVisibleInImage(options.placementMode);
    const targetHeightPx = (options.heightM / metersVisible) * imageHeightPx;
    const correctedHeightPx = clamp(targetHeightPx * (options.userScalePercent / 100), 26, imageHeightPx * 0.62);
    const correctedWidthPx = correctedHeightPx * visual.widthToHeight;
    const widthPercent = clamp((correctedWidthPx / imageWidthPx) * 100, 4, 80);

    return {
        widthPercent,
        visualContactY: visual.contactY,
    };
}

function makeProceduralInflatableSvgDataUrl(options: {
    prompt: string;
    productType: ApiProductType;
    material: MaterialMode;
    lighting: string;
    shapeDetail: number;
}) {
    const prompt = normalizeText(options.prompt);
    const isBurger =
        options.productType === "Replică food" ||
        prompt.includes("burger") ||
        prompt.includes("hamburger");

    const isPenguin = prompt.includes("pinguin") || prompt.includes("penguin");
    const detail = clamp(options.shapeDetail, 15, 100);
    const detailT = (detail - 15) / 85;
    const lowDetail = detail <= 25;
    const mediumDetail = detail <= 55;

    const ledGlow = options.material === "LED interior" || options.material === "Alb translucid";
    const night = options.lighting === "Noapte";
    const warm = options.lighting === "Golden hour";

    const bgGlow = ledGlow
        ? `<ellipse cx="512" cy="418" rx="430" ry="230" fill="rgba(255,215,125,0.22)" filter="url(#blurGlow)" />`
        : "";

    const glossyOpacity = options.material === "PVC mat" ? 0.12 : 0.28;
    const seamOpacity = options.material === "PVC mat" ? 0.14 : 0.22;
    const globalBrightness = night ? 0.78 : warm ? 1.05 : 1;

    let body = "";

    if (isBurger) {
        const bunTop = lowDetail
            ? `<ellipse cx="512" cy="424" rx="345" ry="118" fill="url(#bunTop)" />
               <rect x="198" y="420" width="628" height="86" rx="43" fill="url(#bunTop)" />`
            : `<path d="M170 490 C185 330 840 330 855 490 C805 550 225 550 170 490 Z" fill="url(#bunTop)" />`;

        const sesame = mediumDetail
            ? `<circle cx="392" cy="408" r="7" fill="#fff4d8" opacity="0.62" />
               <circle cx="470" cy="386" r="6" fill="#fff4d8" opacity="0.62" />
               <circle cx="548" cy="399" r="7" fill="#fff4d8" opacity="0.62" />
               <circle cx="620" cy="420" r="5" fill="#fff4d8" opacity="0.62" />`
            : "";

        const lettuce = lowDetail
            ? `<rect x="190" y="520" width="644" height="22" rx="11" fill="#76a83b" opacity="0.96" />`
            : `<path d="M185 520 C225 496 260 545 305 518 C350 490 390 548 440 520 C490 492 535 548 585 520 C635 492 685 548 735 520 C775 498 815 528 842 514 L842 548 L185 548 Z" fill="#6fb33f" />`;

        const cheese = lowDetail
            ? `<rect x="210" y="550" width="604" height="25" rx="12" fill="#d3a22c" opacity="0.98" />`
            : `<path d="M210 550 L812 550 L772 606 L700 566 L628 610 L555 566 L485 608 L420 566 L350 607 L210 575 Z" fill="#f3bd32" />`;

        const patty = `<rect x="195" y="580" width="634" height="${lowDetail ? 42 : 58}" rx="${lowDetail ? 21 : 29}" fill="#5f3b25" opacity="0.98" />`;

        const tomato = detail >= 35
            ? `<rect x="205" y="512" width="614" height="18" rx="9" fill="#c1493d" opacity="0.94" />`
            : "";

        body = `
            <g filter="url(#softShadow)">
                ${bunTop}
                ${sesame}
                ${tomato}
                ${lettuce}
                ${cheese}
                ${patty}
                <rect x="205" y="${lowDetail ? 628 : 650}" width="614" height="${lowDetail ? 76 : 92}" rx="${lowDetail ? 38 : 46}" fill="url(#bunBottom)" />
                <ellipse cx="512" cy="540" rx="350" ry="${160 + detailT * 12}" fill="url(#surfaceGloss)" opacity="${glossyOpacity}" />
                <path d="M220 414 C330 355 690 355 804 414" stroke="rgba(255,255,255,0.24)" stroke-width="18" stroke-linecap="round" fill="none" />
                <path d="M190 495 C235 548 790 548 836 495" stroke="rgba(255,255,255,${seamOpacity})" stroke-width="6" fill="none" />
            </g>
        `;
    } else if (isPenguin) {
        const faceDetails = detail >= 25
            ? `<ellipse cx="455" cy="310" rx="34" ry="38" fill="#ffffff" />
               <ellipse cx="570" cy="310" rx="34" ry="38" fill="#ffffff" />
               <circle cx="455" cy="318" r="13" fill="#111827" />
               <circle cx="570" cy="318" r="13" fill="#111827" />
               <path d="M500 350 L540 350 L520 386 Z" fill="#f59e0b" />`
            : `<path d="M498 350 L540 350 L520 380 Z" fill="#f59e0b" />`;

        body = `
            <g filter="url(#softShadow)">
                <ellipse cx="512" cy="555" rx="220" ry="310" fill="#111827" />
                <ellipse cx="512" cy="598" rx="140" ry="228" fill="#f8fafc" />
                <ellipse cx="512" cy="320" rx="168" ry="142" fill="#111827" />
                ${faceDetails}
                <ellipse cx="388" cy="820" rx="78" ry="32" fill="#f59e0b" />
                <ellipse cx="636" cy="820" rx="78" ry="32" fill="#f59e0b" />
                <ellipse cx="512" cy="555" rx="220" ry="310" fill="url(#surfaceGloss)" opacity="${glossyOpacity}" />
                <ellipse cx="512" cy="555" rx="220" ry="310" fill="none" stroke="rgba(255,255,255,${seamOpacity})" stroke-width="6" />
            </g>
        `;
    } else {
        body = `
            <g filter="url(#softShadow)">
                <ellipse cx="512" cy="540" rx="330" ry="210" fill="url(#genericBase)" />
                <ellipse cx="512" cy="536" rx="326" ry="206" fill="url(#surfaceGloss)" opacity="${glossyOpacity}" />
                <ellipse cx="512" cy="540" rx="330" ry="210" fill="none" stroke="rgba(255,255,255,${seamOpacity})" stroke-width="6" />
                <path d="M250 415 C360 365 664 365 774 415" stroke="rgba(255,255,255,0.26)" stroke-width="20" stroke-linecap="round" fill="none" />
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

        <radialGradient id="bunTop" cx="38%" cy="18%" r="78%">
            <stop offset="0%" stop-color="#ffe1a8" />
            <stop offset="44%" stop-color="#d9953b" />
            <stop offset="100%" stop-color="#a85e1d" />
        </radialGradient>

        <radialGradient id="bunBottom" cx="38%" cy="20%" r="78%">
            <stop offset="0%" stop-color="#f7d18f" />
            <stop offset="48%" stop-color="#ce8735" />
            <stop offset="100%" stop-color="#9a551a" />
        </radialGradient>

        <radialGradient id="surfaceGloss" cx="34%" cy="18%" r="68%">
            <stop offset="0%" stop-color="rgba(255,255,255,0.82)" />
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

    const [generateMode, setGenerateMode] = useState<GenerateMode>("rapid");

    const [respectReference, setRespectReference] = useState(85);
    const [respectShape, setRespectShape] = useState(true);
    const [respectTexture, setRespectTexture] = useState(true);
    const [respectProportions, setRespectProportions] = useState(true);
    const [respectBranding, setRespectBranding] = useState(true);

    const [heightM, setHeightM] = useState(3);
    const [hasGeneratedSimulation, setHasGeneratedSimulation] = useState(false);
    const [estimatedWidthM, setEstimatedWidthM] = useState<number | null>(null);
    const [estimatedDepthM, setEstimatedDepthM] = useState<number | null>(null);

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
    const [overlayScale, setOverlayScale] = useState(100);
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
    const effectiveProductType = resolveClientProductType(subjectPrompt, selectedProductType);
    const effectivePreset = PRODUCT_PRESETS[effectiveProductType];
    const derived = getDerivedDimensions(effectiveProductType, heightM);
    const displayedScene = resultSceneUrl || sceneImage;
    const hasGeneratedVisual = hasGeneratedSimulation || Boolean(overlayUrl || resultSceneUrl);

    const objectFilter = `
        ${getObjectFilter(lighting, material)}
        brightness(${objectBrightness}%)
        contrast(${objectContrast}%)
        sepia(${Math.max(0, objectWarmth) / 100})
        hue-rotate(${objectWarmth < 0 ? objectWarmth : -objectWarmth * 0.12}deg)
    `;

    const resetGeneratedResult = () => {
        setOverlayUrl(null);
        setResultSceneUrl(null);
        setMaskDebugUrl(null);
        setError(null);
        setHasGeneratedSimulation(false);
        setEstimatedWidthM(null);
        setEstimatedDepthM(null);
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
        resetGeneratedResult();
    };

    const handleRefUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const base64 = await fileToBase64(file);
        setRefImage(base64);
        resetGeneratedResult();
    };

    const handleTextureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const base64 = await fileToBase64(file);
        setTextureImage(base64);
        resetGeneratedResult();
    };

    const getContainedImageRect = (): ImageMetrics | null => {
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

    const currentMetrics = useMemo(() => {
        return null;
    }, []);

    const getMarkerPositionInsideStage = () => {
        const metrics = getContainedImageRect();

        if (!metrics) {
            return {
                left: `${posX}%`,
                top: `${posY}%`,
            };
        }

        const imageX = metrics.imageLeft + (posX / 100) * metrics.imageWidth;
        const imageY = metrics.imageTop + (posY / 100) * metrics.imageHeight;

        return {
            left: `${imageX}px`,
            top: `${imageY}px`,
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

        const imageX = (posX / 100) * canvas.width;
        const imageY = (posY / 100) * canvas.height;

        const visual = getProductVisualAspect(effectiveProductType, subjectPrompt);
        const metersVisible = estimateMetersVisibleInImage(placementMode);
        const targetHeightPx = (heightM / metersVisible) * canvas.height;
        const correctedHeightPx = clamp(
            targetHeightPx * (inpaintAreaScale / 100),
            canvas.height * 0.045,
            canvas.height * 0.48
        );
        const correctedWidthPx = correctedHeightPx * visual.widthToHeight;

        const aspect = getInpaintWorkAreaAspect(effectiveProductType, subjectPrompt, shapeDetail);
        const finalW = clamp(correctedWidthPx * aspect.width, canvas.width * 0.045, canvas.width * 0.52);
        const finalH = clamp(correctedHeightPx * aspect.height, canvas.height * 0.045, canvas.height * 0.52);

        let x = imageX - finalW / 2;
        let y = imageY - finalH * visual.contactY;

        if (placementMode === "Suspendat" || placementMode === "Pe fațadă") {
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
                imageY + finalH * 0.04,
                finalW * 0.42,
                finalH * 0.07,
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

        const x = ((clampedX - imageRect.imageLeft) / imageRect.imageWidth) * 100;
        const y = ((clampedY - imageRect.imageTop) / imageRect.imageHeight) * 100;

        setPosX(clamp(x, 0, 100));
        setPosY(clamp(y, 0, 100));
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
            if (generateMode === "rapid") {
                const proceduralUrl = makeProceduralInflatableSvgDataUrl({
                    prompt: subjectPrompt,
                    productType: effectiveProductType,
                    material,
                    lighting,
                    shapeDetail,
                });

                setOverlayUrl(proceduralUrl);
                setHasGeneratedSimulation(true);
                setEstimatedWidthM(derived.widthM);
                setEstimatedDepthM(derived.depthM);
                setLoading(false);
                return;
            }

            const maskBase64 = buildMaskBase64();

            if (!maskBase64) {
                throw new Error("Nu am putut genera masca pentru fotorealism.");
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
                    prompt: subjectPrompt,
                    userPrompt: subjectPrompt,
                    productPreset: effectivePreset,
                    productType: effectiveProductType,
                    selectedUiProductType: selectedProductType,
                    placementMode,
                    generateMode: "replica",
                    renderPipeline: "inpaint",
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
                setHasGeneratedSimulation(true);
                setEstimatedWidthM(derived.widthM);
                setEstimatedDepthM(derived.depthM);
            } else {
                throw new Error("API-ul nu a returnat o imagine fotorealistă validă.");
            }
        } catch (err: any) {
            setError(err.message || "Eroare necunoscută.");
        }

        setLoading(false);
    };

    const metrics = getContainedImageRect();
    const mockupBox = calculateAutoMockupBox({
        productType: effectiveProductType,
        prompt: subjectPrompt,
        heightM,
        imageMetrics: metrics,
        placementMode,
        userScalePercent: overlayScale,
    });

    const markerPosition = getMarkerPositionInsideStage();

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

                            <div className="aztec-label" style={{ marginTop: 10 }}>
                                Imagine referință produs
                            </div>
                            <input
                                className="aztec-input aztec-file-input"
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={handleRefUpload}
                            />

                            <div className="aztec-label" style={{ marginTop: 10 }}>
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
                                    resetGeneratedResult();
                                }}
                                placeholder="Ex: burger, arcadă AZTEC, mascotă urs, sticlă de suc..."
                            />

                            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 10 }}>
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
                                                resetGeneratedResult();
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
                                                padding: "7px 11px",
                                                cursor: "pointer",
                                                fontWeight: 800,
                                                fontSize: 12,
                                            }}
                                        >
                                            {chip}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="aztec-info-box" style={{ marginTop: 10 }}>
                                Tip detectat automat: <strong>{effectiveProductType}</strong>
                            </div>

                            <div className="aztec-label" style={{ marginTop: 10 }}>
                                Poziționare
                            </div>

                            <select
                                className="aztec-select"
                                value={placementMode}
                                onChange={(e) => {
                                    const next = e.target.value as PlacementMode;
                                    setPlacementMode(next);
                                    resetShadowForPlacement(next);
                                    resetGeneratedResult();
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
                                        resetGeneratedResult();
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
                                        setGenerateMode("replica");
                                        resetGeneratedResult();
                                    }}
                                    className={
                                        generateMode === "replica"
                                            ? "aztec-tab aztec-tab-active"
                                            : "aztec-tab"
                                    }
                                >
                                    FOTOREALISM
                                </button>
                            </div>
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
                                    resetGeneratedResult();
                                }}
                            />

                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 1fr",
                                    gap: 8,
                                    marginTop: 10,
                                }}
                            >
                                <label className="aztec-checkbox-row">
                                    <input
                                        className="aztec-checkbox"
                                        type="checkbox"
                                        checked={respectShape}
                                        onChange={(e) => {
                                            setRespectShape(e.target.checked);
                                            resetGeneratedResult();
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
                                            resetGeneratedResult();
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
                                            resetGeneratedResult();
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
                                            resetGeneratedResult();
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
                                    resetGeneratedResult();
                                }}
                            />

                            <div className="aztec-slider-header" style={{ marginTop: 12 }}>
                                <div className="aztec-label">Detaliu formă</div>
                                <div className="aztec-slider-value">{shapeDetail}%</div>
                            </div>

                            <input
                                className="aztec-slider"
                                type="range"
                                min={15}
                                max={100}
                                value={shapeDetail}
                                onChange={(e) => {
                                    setShapeDetail(Number(e.target.value));
                                    resetGeneratedResult();
                                }}
                            />

                            <div className="aztec-info-box" style={{ marginTop: 10 }}>
                                Dimensiuni pentru deviz:
                                <br />
                                <strong style={{ color: "#FFFFFF" }}>
                                    Înălțime țintă: {heightM.toFixed(1)} m
                                    <br />
                                    Lățime:{" "}
                                    {hasGeneratedSimulation && estimatedWidthM !== null
                                        ? `${estimatedWidthM.toFixed(1)} m`
                                        : "se estimează după generare"}
                                    <br />
                                    Lungime / adâncime:{" "}
                                    {hasGeneratedSimulation && estimatedDepthM !== null
                                        ? `${estimatedDepthM.toFixed(1)} m`
                                        : "se estimează după generare"}
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
                                    resetGeneratedResult();
                                }}
                            >
                                <option>PVC lucios</option>
                                <option>PVC mat</option>
                                <option>Alb translucid</option>
                                <option>LED interior</option>
                                <option>Outdoor heavy-duty</option>
                            </select>

                            <div className="aztec-label" style={{ marginTop: 10 }}>
                                Lumină / mediu
                            </div>
                            <select
                                className="aztec-select"
                                value={lighting}
                                onChange={(e) => {
                                    setLighting(e.target.value);
                                    resetGeneratedResult();

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
                            7. POZIȚIONARE INIȚIALĂ
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
                                }}
                            />

                            <div className="aztec-slider-header" style={{ marginTop: 12 }}>
                                <div className="aztec-label">Poziție Y</div>
                                <div className="aztec-slider-value">{posY.toFixed(1)}%</div>
                            </div>

                            <input
                                className="aztec-slider"
                                type="range"
                                min={0}
                                max={100}
                                step={0.1}
                                value={posY}
                                onChange={(e) => {
                                    setPosY(Number(e.target.value));
                                }}
                            />

                            {generateMode === "replica" && (
                                <>
                                    <div className="aztec-slider-header" style={{ marginTop: 12 }}>
                                        <div className="aztec-label">Mărime zonă fotorealism</div>
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
                                            resetGeneratedResult();
                                        }}
                                    />
                                </>
                            )}

                            {!hasGeneratedVisual && (
                                <div className="aztec-info-box" style={{ marginTop: 12 }}>
                                    Click pe imagine sau folosește X/Y pentru punctul de sprijin.
                                    Scala default este 100% și se raportează la înălțimea țintă.
                                </div>
                            )}

                            {hasGeneratedVisual && generateMode === "rapid" && (
                                <>
                                    <div className="aztec-slider-header" style={{ marginTop: 12 }}>
                                        <div className="aztec-label">Scală reală pe imagine</div>
                                        <div className="aztec-slider-value">{overlayScale}%</div>
                                    </div>

                                    <input
                                        className="aztec-slider"
                                        type="range"
                                        min={30}
                                        max={220}
                                        value={overlayScale}
                                        onChange={(e) => {
                                            setOverlayScale(Number(e.target.value));
                                        }}
                                    />

                                    <div className="aztec-slider-header" style={{ marginTop: 12 }}>
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
                                        }}
                                    />
                                </>
                            )}
                        </div>
                    </section>

                    {hasGeneratedVisual && generateMode === "rapid" && (
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
                                    <div key={String(label)} style={{ marginTop: 10 }}>
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
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

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
                                background: "rgba(0,0,0,0.22)",
                                pointerEvents: "none",
                            }}
                        >
                            <div
                                style={{
                                    position: "absolute",
                                    ...markerPosition,
                                    width: 18,
                                    height: 18,
                                    borderRadius: "50%",
                                    background: "#FF6A00",
                                    border: "2px solid rgba(255,255,255,0.95)",
                                    transform: "translate(-50%, -50%)",
                                    boxShadow: "0 0 0 0 rgba(255,106,0,0.75)",
                                    animation: "markerPulse 0.9s ease-out infinite",
                                }}
                            />

                            <div
                                style={{
                                    position: "absolute",
                                    ...markerPosition,
                                    width: 54,
                                    height: 54,
                                    borderRadius: "50%",
                                    border: "2px solid rgba(255,106,0,0.85)",
                                    transform: "translate(-50%, -50%)",
                                    animation: "markerRing 0.9s ease-out infinite",
                                }}
                            />
                        </div>
                    )}

                    {overlayUrl && !resultSceneUrl && (
                        <>
                            <div
                                style={{
                                    position: "absolute",
                                    ...markerPosition,
                                    width: `${mockupBox.widthPercent * (shadowScaleX / 100)}%`,
                                    height: `${mockupBox.widthPercent * (shadowScaleY / 100)}%`,
                                    transform: `translate(calc(-50% + ${shadowX}px), calc(-50% + ${shadowY}px)) skewX(${shadowSkew}deg)`,
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
                                    ...markerPosition,
                                    width: `${mockupBox.widthPercent}%`,
                                    transform: `translate(-50%, -${mockupBox.visualContactY * 100}%) rotate(${rotation}deg)`,
                                    transformOrigin: `50% ${mockupBox.visualContactY * 100}%`,
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
                                position: "absolute",
                                ...markerPosition,
                                transform: "translate(-50%, -50%)",
                            }}
                        />
                    )}
                </div>

                <div className="aztec-preview-footer">
                    <span>Click poziție: X {posX.toFixed(1)}%</span>
                    <span>Y {posY.toFixed(1)}%</span>
                </div>

                {maskDebugUrl && generateMode === "replica" && (
                    <details style={{ marginTop: 10, color: "white" }}>
                        <summary style={{ cursor: "pointer", opacity: 0.75 }}>
                            Debug mască fotorealism
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
                @keyframes markerPulse {
                    0% {
                        box-shadow: 0 0 0 0 rgba(255, 106, 0, 0.75);
                        opacity: 1;
                    }

                    70% {
                        box-shadow: 0 0 0 18px rgba(255, 106, 0, 0);
                        opacity: 1;
                    }

                    100% {
                        box-shadow: 0 0 0 0 rgba(255, 106, 0, 0);
                        opacity: 1;
                    }
                }

                @keyframes markerRing {
                    0% {
                        opacity: 0.9;
                        transform: translate(-50%, -50%) scale(0.45);
                    }

                    100% {
                        opacity: 0;
                        transform: translate(-50%, -50%) scale(1.2);
                    }
                }
            `}</style>
        </div>
    );
}
