"use client";

import { useRef, useState } from "react";

type GenerateMode = "rapid" | "photo" | "replica";
type MaterialMode =
    | "PVC lucios"
    | "PVC mat"
    | "Alb translucid"
    | "LED interior"
    | "Outdoor heavy-duty";

export default function Page() {
    const [sceneImage, setSceneImage] = useState<string | null>(null);
    const [sceneBase64, setSceneBase64] = useState<string | null>(null);

    const [refImage, setRefImage] = useState<string | null>(null);
    const [textureImage, setTextureImage] = useState<string | null>(null);

    const [prompt, setPrompt] = useState(
        "Arcadă gonflabilă publicitară premium, proporții realiste, PVC lucios, amplasată natural în locație."
    );

    const [generateMode, setGenerateMode] = useState<GenerateMode>("replica");

    const [respectReference, setRespectReference] = useState(85);
    const [respectShape, setRespectShape] = useState(true);
    const [respectTexture, setRespectTexture] = useState(true);
    const [respectProportions, setRespectProportions] = useState(true);
    const [respectBranding, setRespectBranding] = useState(true);

    const [widthM, setWidthM] = useState(6);
    const [heightM, setHeightM] = useState(4);
    const [depthM, setDepthM] = useState(1.2);
    const [autoScale, setAutoScale] = useState(true);

    const [material, setMaterial] = useState<MaterialMode>("PVC lucios");
    const [lighting, setLighting] = useState("Zi");
    const [realism, setRealism] = useState(80);

    const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [posX, setPosX] = useState(50);
    const [posY, setPosY] = useState(72);
    const [overlayScale, setOverlayScale] = useState(42);
    const [rotation, setRotation] = useState(0);

    const previewRef = useRef<HTMLDivElement | null>(null);

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

    const applyQuickPrompt = (type: string) => {
        const prompts: Record<string, string> = {
            Arcadă:
                "Arcadă gonflabilă publicitară premium, cu două picioare verticale și traversă superioară rotunjită, proporții realiste, PVC lucios.",
            Mascotă:
                "Mascotă gonflabilă mare, volum rotunjit, expresivă, stabilă, realizabilă în PVC gonflabil.",
            Cupolă:
                "Cupolă gonflabilă eveniment, volum mare, formă rotunjită, material PVC rezistent outdoor.",
            Cort:
                "Cort gonflabil pentru eveniment, structură tubulară gonflabilă, acoperiș moale, aspect premium.",
            Tunel:
                "Tunel gonflabil mare pentru evenimente sportive, structură lungă, intrare rotunjită, PVC lucios.",
            Sticlă:
                "Replică gonflabilă de produs în formă de sticlă, proporții recognoscibile, volum moale, PVC lucios.",
            Custom:
                "Obiect gonflabil personalizat, realist, fabricabil, cu formă stabilă și material PVC profesional.",
        };

        setPrompt(prompts[type] || prompts.Custom);
    };

    const handlePreviewClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (!previewRef.current || !sceneImage) return;

        const rect = previewRef.current.getBoundingClientRect();

        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;

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
                    prompt,
                    generateMode,
                    referenceControl: {
                        respectReference,
                        respectShape,
                        respectTexture,
                        respectProportions,
                        respectBranding,
                    },
                    dimensions: {
                        widthM,
                        heightM,
                        depthM,
                        autoScale,
                    },
                    material,
                    lighting,
                    realism,
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

                            <div className="aztec-help">
                                Fotografia spațiului unde va fi amplasat gonflabilul.
                            </div>

                            <div className="aztec-label" style={{ marginTop: 14 }}>
                                Imagine referință produs
                            </div>
                            <input
                                className="aztec-input aztec-file-input"
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={handleRefUpload}
                            />

                            <div className="aztec-help">
                                Randare, poză, schiță sau produs existent. Pentru replică,
                                aceasta este imaginea principală.
                            </div>

                            <div className="aztec-label" style={{ marginTop: 14 }}>
                                Logo / print / textură custom
                            </div>
                            <input
                                className="aztec-input aztec-file-input"
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={handleTextureUpload}
                            />

                            <div className="aztec-help">
                                Opțional. Folosit pentru aplicarea brandingului sau a unei
                                texturi noi.
                            </div>
                        </div>
                    </section>

                    <section className="aztec-section">
                        <div className="aztec-section-button aztec-section-button-active">
                            2. CE VREI SĂ GENEREZI?
                        </div>

                        <div className="aztec-section-content">
                            <div className="aztec-section-line" />

                            <div className="aztec-label">Descriere</div>
                            <textarea
                                className="aztec-textarea"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                            />

                            <div
                                style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 8,
                                    marginTop: 12,
                                }}
                            >
                                {[
                                    "Arcadă",
                                    "Mascotă",
                                    "Cupolă",
                                    "Cort",
                                    "Tunel",
                                    "Sticlă",
                                    "Custom",
                                ].map((chip) => (
                                    <button
                                        key={chip}
                                        type="button"
                                        onClick={() => applyQuickPrompt(chip)}
                                        style={{
                                            border: "1px solid rgba(255,255,255,0.1)",
                                            background: "rgba(255,255,255,0.04)",
                                            color: "white",
                                            borderRadius: 999,
                                            padding: "8px 12px",
                                            cursor: "pointer",
                                            fontWeight: 700,
                                            fontSize: 12,
                                        }}
                                    >
                                        {chip}
                                    </button>
                                ))}
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

                            <div className="aztec-slider-block">
                                <div>
                                    <div className="aztec-slider-header">
                                        <div className="aztec-label">Lățime</div>
                                        <div className="aztec-slider-value">
                                            {widthM.toFixed(1)} m
                                        </div>
                                    </div>
                                    <input
                                        className="aztec-slider"
                                        type="range"
                                        min={1}
                                        max={20}
                                        step={0.1}
                                        value={widthM}
                                        onChange={(e) =>
                                            setWidthM(Number(e.target.value))
                                        }
                                    />
                                </div>

                                <div>
                                    <div className="aztec-slider-header">
                                        <div className="aztec-label">Înălțime</div>
                                        <div className="aztec-slider-value">
                                            {heightM.toFixed(1)} m
                                        </div>
                                    </div>
                                    <input
                                        className="aztec-slider"
                                        type="range"
                                        min={1}
                                        max={20}
                                        step={0.1}
                                        value={heightM}
                                        onChange={(e) =>
                                            setHeightM(Number(e.target.value))
                                        }
                                    />
                                </div>

                                <div>
                                    <div className="aztec-slider-header">
                                        <div className="aztec-label">Adâncime</div>
                                        <div className="aztec-slider-value">
                                            {depthM.toFixed(1)} m
                                        </div>
                                    </div>
                                    <input
                                        className="aztec-slider"
                                        type="range"
                                        min={0.2}
                                        max={6}
                                        step={0.1}
                                        value={depthM}
                                        onChange={(e) =>
                                            setDepthM(Number(e.target.value))
                                        }
                                    />
                                </div>
                            </div>

                            <label
                                className="aztec-checkbox-row"
                                style={{ marginTop: 14 }}
                            >
                                <input
                                    className="aztec-checkbox"
                                    type="checkbox"
                                    checked={autoScale}
                                    onChange={(e) => setAutoScale(e.target.checked)}
                                />
                                Detectează automat scara din scenă
                            </label>
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
                                onChange={(e) =>
                                    setMaterial(e.target.value as MaterialMode)
                                }
                            >
                                <option>PVC lucios</option>
                                <option>PVC mat</option>
                                <option>Alb translucid</option>
                                <option>LED interior</option>
                                <option>Outdoor heavy-duty</option>
                            </select>

                            <div className="aztec-label" style={{ marginTop: 12 }}>
                                Lumină
                            </div>
                            <select
                                className="aztec-select"
                                value={lighting}
                                onChange={(e) => setLighting(e.target.value)}
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
                                <div className="aztec-label">Scală</div>
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
                                <div className="aztec-label">Realism gonflabil</div>
                                <div className="aztec-slider-value">{realism}%</div>
                            </div>
                            <input
                                className="aztec-slider"
                                type="range"
                                min={0}
                                max={100}
                                value={realism}
                                onChange={(e) => setRealism(Number(e.target.value))}
                            />
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
                        />
                    )}

                    {overlayUrl && (
                        <>
                            <div
                                className="aztec-overlay-shadow"
                                style={{
                                    left: `${posX}%`,
                                    top: `${posY}%`,
                                    width: `${overlayScale * 0.78}%`,
                                    height: `${overlayScale * 0.12}%`,
                                }}
                            />

                            <img
                                className="aztec-generated-overlay"
                                src={overlayUrl}
                                alt="Gonflabil generat"
                                style={{
                                    left: `${posX}%`,
                                    top: `${posY}%`,
                                    width: `${overlayScale}%`,
                                    rotate: `${rotation}deg`,
                                }}
                            />
                        </>
                    )}

                    {sceneImage && (
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
                    <span>
                        Click poziție: X {posX.toFixed(1)}%
                    </span>
                    <span>Y {posY.toFixed(1)}%</span>
                </div>
            </section>
        </div>
    );
}
