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

function getDerivedDimensions(productType: ProductType, heightM: number) {
    if (productType === "Arcadă") {
        return { widthM: heightM * 1.25, depthM: heightM * 0.25 };
    }

    if (productType === "Mascotă") {
        return { widthM: heightM * 0.9, depthM: heightM * 0.55 };
    }

    if (productType === "Cupolă") {
        return { widthM: heightM * 1.8, depthM: heightM * 1.8 };
    }

    if (productType === "Cort") {
        return { widthM: heightM * 1.5, depthM: heightM * 1.5 };
    }

    if (productType === "Tunel") {
        return { widthM: heightM * 1.1, depthM: heightM * 2.2 };
    }

    if (productType === "Sticlă") {
        return { widthM: heightM * 0.35, depthM: heightM * 0.35 };
    }

    return { widthM: heightM, depthM: heightM * 0.5 };
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

function getShadowStyle(
    placementMode: PlacementMode,
    posX: number,
    posY: number,
    overlayScale: number
) {
    if (placementMode === "Pe fațadă") {
        return {
            left: `${posX + 2}%`,
            top: `${posY - overlayScale * 0.28}%`,
            width: `${overlayScale * 0.88}%`,
            height: `${overlayScale * 0.52}%`,
            transform: "translate(-50%, -50%)",
            background:
                "radial-gradient(ellipse at center, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.16) 42%, rgba(0,0,0,0.04) 68%, rgba(0,0,0,0) 78%)",
            filter: "blur(12px)",
            opacity: 0.72,
        };
    }

    if (placementMode === "Suspendat") {
        return {
            left: `${posX}%`,
            top: `${posY + overlayScale * 0.08}%`,
            width: `${overlayScale * 0.7}%`,
            height: `${overlayScale * 0.11}%`,
            transform: "translate(-50%, -50%)",
            background:
                "radial-gradient(ellipse at center, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.09) 46%, rgba(0,0,0,0.02) 70%, rgba(0,0,0,0) 82%)",
            filter: "blur(14px)",
            opacity: 0.55,
        };
    }

    return {
        left: `${posX}%`,
        top: `${posY}%`,
        width: `${overlayScale * 0.82}%`,
        height: `${overlayScale * 0.13}%`,
        transform: "translate(-50%, -50%)",
        background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.22) 42%, rgba(0,0,0,0.05) 68%, rgba(0,0,0,0) 80%)",
        filter: "blur(10px)",
        opacity: 0.82,
    };
}

export default function Page() {
    const [sceneImage, setSceneImage] = useState<string | null>(null);
    const [sceneBase64, setSceneBase64] = useState<string | null>(null);
    const [sceneNatural, setSceneNatural] = useState({ width: 1, height: 1 });

    const [refImage, setRefImage] = useState<string | null>(null);
    const [textureImage, setTextureImage] = useState<string | null>(null);

    const [userPrompt, setUserPrompt] = useState("burger");
    const [selectedProductType, setSelectedProductType] =
        useState<ProductType>("Mascotă");
    const [placementMode, setPlacementMode] =
        useState<PlacementMode>("Pe acoperiș");

    const [generateMode, setGenerateMode] = useState<GenerateMode>("replica");

    const [respectReference, setRespectReference] = useState(85);
    const [respectShape, setRespectShape] = useState(true);
    const [respectTexture, setRespectTexture] = useState(true);
    const [respectProportions, setRespectProportions] = useState(true);
    const [respectBranding, setRespectBranding] = useState(true);

    const [heightM, setHeightM] = useState(3);
    const derived = getDerivedDimensions(selectedProductType, heightM);

    const [material, setMaterial] = useState<MaterialMode>("PVC lucios");
    const [lighting, setLighting] = useState("Zi");

    const [shapeDetail, setShapeDetail] = useState(5);

    const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [posX, setPosX] = useState(54);
    const [posY, setPosY] = useState(72);
    const [overlayScale, setOverlayScale] = useState(32);
    const [rotation, setRotation] = useState(0);

    const previewRef = useRef<HTMLDivElement | null>(null);

    const subjectPrompt = cleanUserPrompt(userPrompt) || userPrompt.trim();
    const fullPrompt = `${subjectPrompt}. ${PRODUCT_PRESETS[selectedProductType]}`;
    const shadowStyle = getShadowStyle(placementMode, posX, posY, overlayScale);

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

    const handleSceneUpload = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const base64 = await fileToBase64(file);
        setSceneBase64(base64);
        setSceneImage(`data:${file.type};base64,${base64}`);
        setOverlayUrl(null);
        setError(null);
    };

    const handleRefUpload = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const base64 = await fileToBase64(file);
        setRefImage(base64);
        setOverlayUrl(null);
        setError(null);
    };

    const handleTextureUpload = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const base64 = await fileToBase64(file);
        setTextureImage(base64);
        setOverlayUrl(null);
        setError(null);
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

    const handlePreviewClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (!previewRef.current || !sceneImage || loading || overlayUrl) return;

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

        setPosX(Math.max(0, Math.min(100, x)));
        setPosY(Math.max(0, Math.min(100, y)));
    };

    const handleGenerate = async () => {
        if (!sceneBase64) {
            setError("Încarcă mai întâi imaginea locației.");
            return;
        }

        setLoading(true);
        setError(null);
        setOverlayUrl(null);

        try {
            const response = await fetch("/api/generate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    sceneImage: sceneBase64,
                    refImage,
                    textureImage,
                    prompt: fullPrompt,
                    userPrompt: subjectPrompt,
                    productPreset: PRODUCT_PRESETS[selectedProductType],
                    productType: selectedProductType,
                    placementMode,
                    generateMode,
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
                    },
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Eroare la generare.");
            }

            if (!data.overlayUrl) {
                throw new Error("API-ul nu a returnat imaginea generată.");
            }

            setOverlayUrl(data.overlayUrl);
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
                                    setOverlayUrl(null);
                                }}
                                placeholder="Ex: burger, arcadă AZTEC, mascotă urs, sticlă de suc..."
                            />

                            <div
                                style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 8,
                                    marginTop: 12,
                                }}
                            >
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
                                                setOverlayUrl(null);
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
                                    setPlacementMode(e.target.value as PlacementMode);
                                    setOverlayUrl(null);
                                }}
                            >
                                <option>Pe sol</option>
                                <option>Pe acoperiș</option>
                                <option>Pe fațadă</option>
                                <option>Suspendat</option>
                                <option>În interior</option>
                            </select>

                            <div className="aztec-info-box" style={{ marginTop: 14 }}>
                                Text trimis de utilizator:
                                <br />
                                <strong style={{ color: "#FFFFFF" }}>
                                    {userPrompt}
                                </strong>
                            </div>
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
                                    onClick={() => setGenerateMode("rapid")}
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
                                    onClick={() => setGenerateMode("photo")}
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
                                onClick={() => setGenerateMode("replica")}
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
                                <div className="aztec-slider-value">
                                    {respectReference}%
                                </div>
                            </div>

                            <input
                                className="aztec-slider"
                                type="range"
                                min={0}
                                max={100}
                                value={respectReference}
                                onChange={(e) =>
                                    setRespectReference(Number(e.target.value))
                                }
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
                                        onChange={(e) =>
                                            setRespectShape(e.target.checked)
                                        }
                                    />
                                    Forma
                                </label>

                                <label className="aztec-checkbox-row">
                                    <input
                                        className="aztec-checkbox"
                                        type="checkbox"
                                        checked={respectTexture}
                                        onChange={(e) =>
                                            setRespectTexture(e.target.checked)
                                        }
                                    />
                                    Textura
                                </label>

                                <label className="aztec-checkbox-row">
                                    <input
                                        className="aztec-checkbox"
                                        type="checkbox"
                                        checked={respectProportions}
                                        onChange={(e) =>
                                            setRespectProportions(e.target.checked)
                                        }
                                    />
                                    Proporții
                                </label>

                                <label className="aztec-checkbox-row">
                                    <input
                                        className="aztec-checkbox"
                                        type="checkbox"
                                        checked={respectBranding}
                                        onChange={(e) =>
                                            setRespectBranding(e.target.checked)
                                        }
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
                                <div className="aztec-slider-value">
                                    {heightM.toFixed(1)} m
                                </div>
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
                                    setOverlayUrl(null);
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
                                    Lungime / adâncime:{" "}
                                    {derived.depthM.toFixed(1)} m
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
                                    setOverlayUrl(null);
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
                                    setOverlayUrl(null);
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
                                <div className="aztec-slider-value">
                                    {posX.toFixed(1)}%
                                </div>
                            </div>

                            <input
                                className="aztec-slider"
                                type="range"
                                min={0}
                                max={100}
                                step={0.1}
                                value={posX}
                                onChange={(e) => setPosX(Number(e.target.value))}
                            />

                            <div
                                className="aztec-slider-header"
                                style={{ marginTop: 14 }}
                            >
                                <div className="aztec-label">Poziție Y</div>
                                <div className="aztec-slider-value">
                                    {posY.toFixed(1)}%
                                </div>
                            </div>

                            <input
                                className="aztec-slider"
                                type="range"
                                min={0}
                                max={100}
                                step={0.1}
                                value={posY}
                                onChange={(e) => setPosY(Number(e.target.value))}
                            />

                            <div
                                className="aztec-slider-header"
                                style={{ marginTop: 14 }}
                            >
                                <div className="aztec-label">Scală pe imagine</div>
                                <div className="aztec-slider-value">
                                    {overlayScale}%
                                </div>
                            </div>

                            <input
                                className="aztec-slider"
                                type="range"
                                min={5}
                                max={120}
                                value={overlayScale}
                                onChange={(e) =>
                                    setOverlayScale(Number(e.target.value))
                                }
                            />

                            <div
                                className="aztec-slider-header"
                                style={{ marginTop: 14 }}
                            >
                                <div className="aztec-label">Rotație</div>
                                <div className="aztec-slider-value">
                                    {rotation}°
                                </div>
                            </div>

                            <input
                                className="aztec-slider"
                                type="range"
                                min={-30}
                                max={30}
                                value={rotation}
                                onChange={(e) =>
                                    setRotation(Number(e.target.value))
                                }
                            />

                            <div
                                className="aztec-slider-header"
                                style={{ marginTop: 14 }}
                            >
                                <div className="aztec-label">
                                    Detaliu formă
                                </div>
                                <div className="aztec-slider-value">
                                    {shapeDetail}%
                                </div>
                            </div>

                            <input
                                className="aztec-slider"
                                type="range"
                                min={0}
                                max={100}
                                value={shapeDetail}
                                onChange={(e) => {
                                    setShapeDetail(Number(e.target.value));
                                    setOverlayUrl(null);
                                }}
                            />

                            <div className="aztec-info-box" style={{ marginTop: 12 }}>
                                Markerul reprezintă punctul de sprijin al obiectului,
                                nu centrul. Obiectul generat se așază cu baza pe marker.
                            </div>
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
                    {!sceneImage && (
                        <div className="aztec-preview-placeholder">
                            Încarcă o imagine de locație pentru previzualizare
                        </div>
                    )}

                    {sceneImage && (
                        <img
                            className="aztec-preview-image"
                            src={sceneImage}
                            alt="Scenă"
                            onLoad={(event) => {
                                setSceneNatural({
                                    width: event.currentTarget.naturalWidth,
                                    height: event.currentTarget.naturalHeight,
                                });
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
                                    Se folosește poziția marcată. Nu închide pagina.
                                </div>
                            </div>
                        </div>
                    )}

                    {overlayUrl && (
                        <>
                            <div
                                className="aztec-overlay-shadow"
                                style={{
                                    position: "absolute",
                                    zIndex: 2,
                                    pointerEvents: "none",
                                    ...shadowStyle,
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
                                }}
                            />
                        </>
                    )}

                    {sceneImage && !overlayUrl && !loading && (
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
