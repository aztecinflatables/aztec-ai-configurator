"use client";

import { useState, useRef } from "react";

export default function Page() {
    const [sceneImage, setSceneImage] = useState<string | null>(null);
    const [refImage, setRefImage] = useState<string | null>(null);
    const [desc, setDesc] = useState("arcada");
    const [pozitie, setPozitie] = useState("Pe sol");
    const [complexitate, setComplexitate] = useState(30);
    const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [posX, setPosX] = useState(50);
    const [posY, setPosY] = useState(70);

    const fileToBase64 = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve((reader.result as string).split(",")[1]);
            reader.onerror = reject;
        });

    const handleSceneUpload = async (e: any) => {
        const file = e.target.files[0];
        if (!file) return;
        const base64 = await fileToBase64(file);
        setSceneImage(`data:image/jpeg;base64,${base64}`);
    };

    const handleRefUpload = async (e: any) => {
        const file = e.target.files[0];
        if (!file) return;
        const base64 = await fileToBase64(file);
        setRefImage(base64);
    };

    const handleGenerate = async () => {
        if (!sceneImage) {
            setError("Trebuie să încarci imaginea scenei.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    image: sceneImage.split(",")[1],
                    refImage,
                    desc,
                    pozitie,
                    complexitate
                })
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Eroare API");

            setOverlayUrl(data.overlayUrl);
        } catch (e: any) {
            setError(e.message);
        }

        setLoading(false);
    };

    const handleClick = (e: any) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setPosX(x);
        setPosY(y);
    };

    return (
        <div className="aztec-grid">
            <div className="aztec-left-panel">
                <div className="aztec-tabs">
                    <button className="aztec-tab aztec-tab-active">CLIENT</button>
                    <button className="aztec-tab">ADMIN</button>
                </div>

                <div className="aztec-title">CONFIGURARE AI</div>
                <div className="aztec-separator" />

                <div className="aztec-sections">
                    <div className="aztec-section">
                        <div className="aztec-section-button aztec-section-button-active">
                            1. IMAGINI SCENĂ
                        </div>
                        <div className="aztec-section-content">
                            <div className="aztec-label">Imagine fundal</div>
                            <input
                                type="file"
                                className="aztec-input aztec-file-input"
                                onChange={handleSceneUpload}
                            />

                            <div className="aztec-label" style={{ marginTop: 10 }}>
                                Imagine referință (opțional)
                            </div>
                            <input
                                type="file"
                                className="aztec-input aztec-file-input"
                                onChange={handleRefUpload}
                            />
                        </div>
                    </div>

                    <div className="aztec-section">
                        <div className="aztec-section-button aztec-section-button-active">
                            2. DETALII OBIECT
                        </div>
                        <div className="aztec-section-content">
                            <div className="aztec-label">Descriere</div>
                            <textarea
                                className="aztec-textarea"
                                value={desc}
                                onChange={(e) => setDesc(e.target.value)}
                            />

                            <div className="aztec-two-cols" style={{ marginTop: 12 }}>
                                <div>
                                    <div className="aztec-label">Poziționare</div>
                                    <select
                                        className="aztec-select"
                                        value={pozitie}
                                        onChange={(e) => setPozitie(e.target.value)}
                                    >
                                        <option>Pe sol</option>
                                        <option>Pe clădire</option>
                                        <option>În aer</option>
                                    </select>
                                </div>

                                <div>
                                    <div className="aztec-label">Complexitate</div>
                                    <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        value={complexitate}
                                        className="aztec-slider"
                                        onChange={(e) =>
                                            setComplexitate(Number(e.target.value))
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {error && <div className="aztec-error-box">{error}</div>}

                    <button
                        className="aztec-generate-button"
                        onClick={handleGenerate}
                        disabled={loading}
                    >
                        {loading ? "Se generează..." : "GENEREAZĂ OBIECTUL"}
                    </button>
                </div>
            </div>

            <div className="aztec-preview-panel">
                <div
                    className="aztec-preview-stage aztec-preview-stage-clickable"
                    onClick={handleClick}
                >
                    {!sceneImage && (
                        <div className="aztec-preview-placeholder">
                            Încarcă o imagine de fundal
                        </div>
                    )}

                    {sceneImage && (
                        <img
                            src={sceneImage}
                            className="aztec-preview-image"
                        />
                    )}

                    {overlayUrl && (
                        <img
                            src={overlayUrl}
                            className="aztec-generated-overlay"
                            style={{
                                left: `${posX}%`,
                                top: `${posY}%`,
                                width: "30%"
                            }}
                        />
                    )}

                    <div
                        className="aztec-position-dot"
                        style={{ left: `${posX}%`, top: `${posY}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
