"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Category =
  | "arcada"
  | "mascota"
  | "cupola"
  | "cort"
  | "tunel"
  | "sticla"
  | "custom";

type Placement = "ground" | "roof" | "wall";
type RenderStyle = "mockup" | "photorealism";
type Lighting = "day" | "night";

type SceneDimensions = {
  width: number;
  height: number;
};

type EstimatedDims = {
  widthM: number | null;
  depthM: number | null;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function inferDetectedType(prompt: string, category: Category): string {
  const t = prompt.toLowerCase();

  if (t.includes("burger") || t.includes("hamburger") || t.includes("pizza") || t.includes("food")) {
    return "Replică food";
  }
  if (t.includes("pinguin") || t.includes("penguin") || t.includes("catel") || t.includes("dog") || t.includes("urs") || t.includes("bear")) {
    return "Mascotă";
  }
  if (category === "arcada") return "Arcadă";
  if (category === "tunel") return "Tunel";
  if (category === "cupola") return "Cupolă";
  if (category === "cort") return "Cort";
  if (category === "sticla") return "Structură transparentă";
  if (category === "mascota") return "Mascotă";
  return "Obiect gonflabil";
}

function inferSubjectShapeRatios(prompt: string, category: Category) {
  const text = `${prompt} ${category}`.toLowerCase();

  if (text.includes("burger") || text.includes("hamburger")) {
    return { widthByHeight: 1.32, depthByHeight: 0.72, silhouette: "food" as const };
  }
  if (text.includes("pinguin") || text.includes("penguin")) {
    return { widthByHeight: 0.72, depthByHeight: 0.62, silhouette: "mascot" as const };
  }
  if (text.includes("catel") || text.includes("dog")) {
    return { widthByHeight: 1.05, depthByHeight: 0.65, silhouette: "mascot" as const };
  }
  if (category === "arcada") {
    return { widthByHeight: 1.75, depthByHeight: 0.35, silhouette: "arch" as const };
  }
  if (category === "tunel") {
    return { widthByHeight: 1.6, depthByHeight: 1.3, silhouette: "arch" as const };
  }
  if (category === "cupola") {
    return { widthByHeight: 1.45, depthByHeight: 1.1, silhouette: "dome" as const };
  }
  if (category === "cort") {
    return { widthByHeight: 1.4, depthByHeight: 1.2, silhouette: "dome" as const };
  }

  return { widthByHeight: 0.95, depthByHeight: 0.7, silhouette: "generic" as const };
}

function estimateDimensionsForQuote(prompt: string, category: Category, targetHeightM: number): EstimatedDims {
  const ratios = inferSubjectShapeRatios(prompt, category);
  return {
    widthM: Number((targetHeightM * ratios.widthByHeight).toFixed(1)),
    depthM: Number((targetHeightM * ratios.depthByHeight).toFixed(1)),
  };
}

async function getImageDimensions(dataUrl: string): Promise<SceneDimensions> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

async function generateMaskDataUrl(opts: {
  sceneImage: string;
  prompt: string;
  category: Category;
  positionX: number;
  positionY: number;
  targetHeightM: number;
  detailPercent: number;
  initialScalePercent: number;
  inpaintZonePercent: number;
}) {
  const dims = await getImageDimensions(opts.sceneImage);
  const canvas = document.createElement("canvas");
  canvas.width = dims.width;
  canvas.height = dims.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Nu pot crea canvas pentru mască.");
  }

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const ratios = inferSubjectShapeRatios(opts.prompt, opts.category);

  const anchorX = (opts.positionX / 100) * canvas.width;
  const anchorY = (opts.positionY / 100) * canvas.height;

  const pixelsPerMeter = canvas.height * 0.065;
  const effectiveScale = opts.initialScalePercent / 100;
  const subjectHeightPx = Math.max(90, opts.targetHeightM * pixelsPerMeter * effectiveScale);
  const subjectWidthPx = Math.max(120, subjectHeightPx * ratios.widthByHeight);

  const zonePad = opts.inpaintZonePercent / 100;
  const maskWidth = subjectWidthPx * zonePad;
  const maskHeight = subjectHeightPx * zonePad;

  const left = anchorX - maskWidth / 2;
  const top = anchorY - maskHeight;
  const radius = Math.min(maskWidth, maskHeight) * 0.18;

  ctx.fillStyle = "#ffffff";

  const drawRoundRect = (x: number, y: number, w: number, h: number, r: number) => {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
    ctx.fill();
  };

  if (ratios.silhouette === "food") {
    ctx.beginPath();
    ctx.ellipse(anchorX, anchorY - subjectHeightPx * 0.5, maskWidth * 0.5, maskHeight * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (ratios.silhouette === "arch") {
    drawRoundRect(left, top, maskWidth, maskHeight, radius);
  } else if (ratios.silhouette === "dome") {
    ctx.beginPath();
    ctx.ellipse(anchorX, anchorY - maskHeight * 0.5, maskWidth * 0.5, maskHeight * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    drawRoundRect(left, top, maskWidth, maskHeight, radius);
  }

  return canvas.toDataURL("image/png");
}

export default function Page() {
  const previewRef = useRef<HTMLDivElement | null>(null);

  const [activeRole, setActiveRole] = useState<"client" | "admin">("client");

  const [sceneImage, setSceneImage] = useState<string>("");
  const [referenceImage, setReferenceImage] = useState<string>("");
  const [logoImage, setLogoImage] = useState<string>("");

  const [promptText, setPromptText] = useState("hamburger");
  const [category, setCategory] = useState<Category>("mascota");
  const [placement, setPlacement] = useState<Placement>("ground");

  const [renderStyle, setRenderStyle] = useState<RenderStyle>("photorealism");

  const [respectPercent, setRespectPercent] = useState(85);
  const [respectShape, setRespectShape] = useState(true);
  const [respectTexture, setRespectTexture] = useState(true);
  const [respectProportions, setRespectProportions] = useState(true);
  const [respectBranding, setRespectBranding] = useState(true);

  const [targetHeightM, setTargetHeightM] = useState(3);
  const [detailPercent, setDetailPercent] = useState(15);

  const [material, setMaterial] = useState("pvc-glossy");
  const [lighting, setLighting] = useState<Lighting>("day");

  const [positionX, setPositionX] = useState(58);
  const [positionY, setPositionY] = useState(92);
  const [initialScalePercent, setInitialScalePercent] = useState(100);
  const [inpaintZonePercent, setInpaintZonePercent] = useState(118);
  const [rotationDeg, setRotationDeg] = useState(0);

  const [shadowX, setShadowX] = useState(3);
  const [shadowY, setShadowY] = useState(2);
  const [shadowWidth, setShadowWidth] = useState(84);
  const [shadowHeight, setShadowHeight] = useState(15);
  const [shadowBlur, setShadowBlur] = useState(16);
  const [shadowOpacity, setShadowOpacity] = useState(36);

  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [temperature, setTemperature] = useState(0);
  const [objectOpacity, setObjectOpacity] = useState(100);

  const [generatedImage, setGeneratedImage] = useState<string>("");
  const [debugMaskImage, setDebugMaskImage] = useState<string>("");
  const [debugPrompt, setDebugPrompt] = useState<string>("");
  const [estimatedDims, setEstimatedDims] = useState<EstimatedDims>({
    widthM: null,
    depthM: null,
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const detectedType = useMemo(
    () => inferDetectedType(promptText, category),
    [promptText, category]
  );

  const showPostGenerateControls = Boolean(generatedImage);

  useEffect(() => {
    setGeneratedImage("");
    setDebugPrompt("");
    setDebugMaskImage("");
    setEstimatedDims({ widthM: null, depthM: null });
  }, [sceneImage]);

  const displayImage = generatedImage || sceneImage;

  const handleImagePick = async (
    file: File | undefined,
    setter: (v: string) => void
  ) => {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setter(dataUrl);
    setErrorMessage("");
  };

  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!previewRef.current || !sceneImage) return;

    const rect = previewRef.current.getBoundingClientRect();
    const x = clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100);
    const y = clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100);

    setPositionX(Number(x.toFixed(1)));
    setPositionY(Number(y.toFixed(1)));
  };

  const updateEstimatedDimsAfterGeneration = () => {
    const dims = estimateDimensionsForQuote(promptText, category, targetHeightM);
    setEstimatedDims(dims);
  };

  const generate = async () => {
    try {
      setErrorMessage("");

      if (!sceneImage) {
        setErrorMessage("Încarcă mai întâi imaginea locației.");
        return;
      }

      setIsGenerating(true);

      const maskDataUrl = await generateMaskDataUrl({
        sceneImage,
        prompt: promptText,
        category,
        positionX,
        positionY,
        targetHeightM,
        detailPercent,
        initialScalePercent,
        inpaintZonePercent,
      });

      setDebugMaskImage(maskDataUrl);

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sceneImage,
          referenceImage: referenceImage || null,
          logoImage: logoImage || null,
          maskImage: maskDataUrl,
          prompt: promptText,
          category,
          detectedType,
          placement,
          renderStyle,
          targetHeightM,
          detailPercent,
          respectPercent,
          respectShape,
          respectTexture,
          respectProportions,
          respectBranding,
          material,
          lighting,
          positionX,
          positionY,
          scalePercent: initialScalePercent,
          rotationDeg,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Generarea a eșuat.");
      }

      setGeneratedImage(json.imageDataUrl);
      setDebugPrompt(json.debugPrompt || "");
      updateEstimatedDimsAfterGeneration();
    } catch (err: any) {
      setErrorMessage(err?.message || "A apărut o eroare.");
    } finally {
      setIsGenerating(false);
    }
  };

  const markerStyle: React.CSSProperties = {
    left: `${positionX}%`,
    top: `${positionY}%`,
    transform: "translate(-50%, -50%)",
  };

  return (
    <>
      <div className="page">
        <aside className="panel">
          <div className="roleSwitch">
            <button
              className={activeRole === "client" ? "active" : ""}
              onClick={() => setActiveRole("client")}
            >
              CLIENT
            </button>
            <button
              className={activeRole === "admin" ? "active" : ""}
              onClick={() => setActiveRole("admin")}
            >
              ADMIN
            </button>
          </div>

          <h1 className="title">CONFIGURARE AI</h1>

          <section className="card">
            <h2>1. IMAGINI</h2>

            <label className="field">
              <span>Imagine locație</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImagePick(e.target.files?.[0], setSceneImage)}
              />
            </label>

            <label className="field">
              <span>Imagine referință produs</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImagePick(e.target.files?.[0], setReferenceImage)}
              />
            </label>

            <label className="field">
              <span>Logo / print / textură custom</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImagePick(e.target.files?.[0], setLogoImage)}
              />
            </label>
          </section>

          <section className="card">
            <h2>2. CE VREI SĂ GENEREZI?</h2>

            <label className="field">
              <span>Descriere scurtă</span>
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                rows={3}
              />
            </label>

            <div className="pillRow">
              {[
                ["arcada", "Arcadă"],
                ["mascota", "Mascătă"],
                ["cupola", "Cupolă"],
                ["cort", "Cort"],
                ["tunel", "Tunel"],
                ["sticla", "Sticlă"],
                ["custom", "Custom"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={`pill ${category === value ? "active" : ""}`}
                  onClick={() => setCategory(value as Category)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="ghostBox">Tip detectat automat: {detectedType}</div>

            <label className="field">
              <span>Poziționare</span>
              <select
                value={placement}
                onChange={(e) => setPlacement(e.target.value as Placement)}
              >
                <option value="ground">Pe sol</option>
                <option value="roof">Pe clădire</option>
                <option value="wall">Pe perete / fațadă</option>
              </select>
            </label>
          </section>

          <section className="card">
            <h2>3. STIL GENERARE</h2>
            <div className="segmented">
              <button
                className={renderStyle === "mockup" ? "active" : ""}
                onClick={() => setRenderStyle("mockup")}
                type="button"
              >
                MOCKUP
              </button>
              <button
                className={renderStyle === "photorealism" ? "active" : ""}
                onClick={() => setRenderStyle("photorealism")}
                type="button"
              >
                FOTOREALISM
              </button>
            </div>
          </section>

          <section className="card">
            <h2>4. CONTROL REFERINȚĂ</h2>

            <div className="rangeField">
              <div className="rangeHead">
                <span>Respectă referința</span>
                <strong>{respectPercent}%</strong>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={respectPercent}
                onChange={(e) => setRespectPercent(Number(e.target.value))}
              />
            </div>

            <div className="checkGrid">
              <label><input type="checkbox" checked={respectShape} onChange={(e) => setRespectShape(e.target.checked)} /> Forma</label>
              <label><input type="checkbox" checked={respectTexture} onChange={(e) => setRespectTexture(e.target.checked)} /> Textura</label>
              <label><input type="checkbox" checked={respectProportions} onChange={(e) => setRespectProportions(e.target.checked)} /> Proporții</label>
              <label><input type="checkbox" checked={respectBranding} onChange={(e) => setRespectBranding(e.target.checked)} /> Branding</label>
            </div>
          </section>

          <section className="card">
            <h2>5. GABARIT</h2>

            <div className="rangeField">
              <div className="rangeHead">
                <span>Înălțime țintă</span>
                <strong>{targetHeightM.toFixed(1)} m</strong>
              </div>
              <input
                type="range"
                min={1}
                max={12}
                step={0.1}
                value={targetHeightM}
                onChange={(e) => setTargetHeightM(Number(e.target.value))}
              />
            </div>

            <div className="rangeField">
              <div className="rangeHead">
                <span>Detaliu formă</span>
                <strong>{detailPercent}%</strong>
              </div>
              <input
                type="range"
                min={15}
                max={100}
                step={1}
                value={detailPercent}
                onChange={(e) => setDetailPercent(Number(e.target.value))}
              />
            </div>

            <div className="quoteBox">
              <div>Dimensiuni pentru deviz:</div>
              <strong>Înălțime țintă: {targetHeightM.toFixed(1)} m</strong>
              <strong>
                Lățime:{" "}
                {estimatedDims.widthM == null
                  ? "se estimează după generare"
                  : `${estimatedDims.widthM.toFixed(1)} m`}
              </strong>
              <strong>
                Lungime / adâncime:{" "}
                {estimatedDims.depthM == null
                  ? "se estimează după generare"
                  : `${estimatedDims.depthM.toFixed(1)} m`}
              </strong>
            </div>
          </section>

          <section className="card">
            <h2>6. MATERIAL & LUMINĂ</h2>

            <label className="field">
              <span>Material</span>
              <select value={material} onChange={(e) => setMaterial(e.target.value)}>
                <option value="pvc-glossy">PVC lucios</option>
                <option value="pvc-matte">PVC mat</option>
                <option value="white-translucent">Alb translucid</option>
                <option value="led-interior">LED interior</option>
              </select>
            </label>

            <label className="field">
              <span>Lumină / mediu</span>
              <select value={lighting} onChange={(e) => setLighting(e.target.value as Lighting)}>
                <option value="day">Zi</option>
                <option value="night">Noapte</option>
              </select>
            </label>
          </section>

          {showPostGenerateControls && (
            <>
              <section className="card">
                <h2>7. POZIȚIONARE INIȚIALĂ</h2>

                <div className="rangeField">
                  <div className="rangeHead">
                    <span>Poziție X</span>
                    <strong>{positionX.toFixed(1)}%</strong>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={0.1}
                    value={positionX}
                    onChange={(e) => setPositionX(Number(e.target.value))}
                  />
                </div>

                <div className="rangeField">
                  <div className="rangeHead">
                    <span>Poziție Y</span>
                    <strong>{positionY.toFixed(1)}%</strong>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={0.1}
                    value={positionY}
                    onChange={(e) => setPositionY(Number(e.target.value))}
                  />
                </div>

                <div className="rangeField">
                  <div className="rangeHead">
                    <span>Scală pe imagine</span>
                    <strong>{initialScalePercent}%</strong>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={180}
                    step={1}
                    value={initialScalePercent}
                    onChange={(e) => setInitialScalePercent(Number(e.target.value))}
                  />
                </div>

                <div className="rangeField">
                  <div className="rangeHead">
                    <span>Mărime zonă inpaint</span>
                    <strong>{inpaintZonePercent}%</strong>
                  </div>
                  <input
                    type="range"
                    min={100}
                    max={180}
                    step={1}
                    value={inpaintZonePercent}
                    onChange={(e) => setInpaintZonePercent(Number(e.target.value))}
                  />
                </div>

                <div className="rangeField">
                  <div className="rangeHead">
                    <span>Rotație</span>
                    <strong>{rotationDeg}°</strong>
                  </div>
                  <input
                    type="range"
                    min={-25}
                    max={25}
                    step={1}
                    value={rotationDeg}
                    onChange={(e) => setRotationDeg(Number(e.target.value))}
                  />
                </div>
              </section>

              <section className="card">
                <h2>8. UMBRĂ & INTEGRARE</h2>

                <div className="rangeField">
                  <div className="rangeHead"><span>Umbră X</span><strong>{shadowX}%</strong></div>
                  <input type="range" min={-30} max={30} value={shadowX} onChange={(e) => setShadowX(Number(e.target.value))} />
                </div>

                <div className="rangeField">
                  <div className="rangeHead"><span>Umbră Y</span><strong>{shadowY}%</strong></div>
                  <input type="range" min={-30} max={30} value={shadowY} onChange={(e) => setShadowY(Number(e.target.value))} />
                </div>

                <div className="rangeField">
                  <div className="rangeHead"><span>Lățime umbră</span><strong>{shadowWidth}%</strong></div>
                  <input type="range" min={20} max={150} value={shadowWidth} onChange={(e) => setShadowWidth(Number(e.target.value))} />
                </div>

                <div className="rangeField">
                  <div className="rangeHead"><span>Înălțime umbră</span><strong>{shadowHeight}%</strong></div>
                  <input type="range" min={5} max={60} value={shadowHeight} onChange={(e) => setShadowHeight(Number(e.target.value))} />
                </div>

                <div className="rangeField">
                  <div className="rangeHead"><span>Blur umbră</span><strong>{shadowBlur}px</strong></div>
                  <input type="range" min={0} max={40} value={shadowBlur} onChange={(e) => setShadowBlur(Number(e.target.value))} />
                </div>

                <div className="rangeField">
                  <div className="rangeHead"><span>Opacitate umbră</span><strong>{shadowOpacity}%</strong></div>
                  <input type="range" min={0} max={100} value={shadowOpacity} onChange={(e) => setShadowOpacity(Number(e.target.value))} />
                </div>

                <div className="rangeField">
                  <div className="rangeHead"><span>Brightness object</span><strong>{brightness}%</strong></div>
                  <input type="range" min={50} max={150} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} />
                </div>

                <div className="rangeField">
                  <div className="rangeHead"><span>Contrast object</span><strong>{contrast}%</strong></div>
                  <input type="range" min={50} max={150} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} />
                </div>

                <div className="rangeField">
                  <div className="rangeHead"><span>Temperatură object</span><strong>{temperature}</strong></div>
                  <input type="range" min={-50} max={50} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} />
                </div>

                <div className="rangeField">
                  <div className="rangeHead"><span>Opacitate object</span><strong>{objectOpacity}%</strong></div>
                  <input type="range" min={20} max={100} value={objectOpacity} onChange={(e) => setObjectOpacity(Number(e.target.value))} />
                </div>
              </section>
            </>
          )}

          <button className="generateButton" onClick={generate} disabled={isGenerating}>
            {isGenerating ? "SE GENEREAZĂ..." : "GENEREAZĂ SIMULAREA"}
          </button>
          <div className="generateNote">Timp estimativ: 30-60 secunde</div>

          {errorMessage && <div className="errorBox">{errorMessage}</div>}
        </aside>

        <main className="previewArea">
          <div
            className="previewFrame"
            ref={previewRef}
            onClick={handlePreviewClick}
          >
            {displayImage ? (
              <img
                src={displayImage}
                alt="Preview"
                className="previewImage"
                style={{
                  filter: `brightness(${brightness}%) contrast(${contrast}%)`,
                  opacity: objectOpacity / 100,
                }}
              />
            ) : (
              <div className="emptyPreview">Încarcă o imagine de locație.</div>
            )}

            {sceneImage && (
              <div
                className={`marker ${isGenerating ? "blinking" : ""}`}
                style={markerStyle}
                title="Poziție anchor"
              />
            )}

            {isGenerating && (
              <div
                className="generatingBadge"
                style={markerStyle}
              >
                Generez...
              </div>
            )}
          </div>

          <div className="coordsBar">
            <span>Click poziție: X {positionX.toFixed(1)}%</span>
            <span>Y {positionY.toFixed(1)}%</span>
          </div>

          <details className="debugBlock">
            <summary>Debug mască inpaint</summary>
            {debugMaskImage ? (
              <img src={debugMaskImage} alt="Mask debug" className="debugMask" />
            ) : (
              <div className="debugEmpty">Nu există încă mască.</div>
            )}
          </details>

          <details className="debugBlock">
            <summary>Debug prompt</summary>
            <pre className="debugPrompt">{debugPrompt || "Nu există încă prompt."}</pre>
          </details>
        </main>
      </div>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html, body {
          margin: 0;
          padding: 0;
          background:
            radial-gradient(circle at top left, rgba(255, 111, 0, 0.18), transparent 24%),
            linear-gradient(180deg, #05080f 0%, #060913 100%);
          color: #ffffff;
          font-family: Inter, Arial, sans-serif;
        }

        body {
          min-height: 100vh;
        }

        button,
        input,
        select,
        textarea {
          font: inherit;
        }

        .page {
          display: grid;
          grid-template-columns: 410px 1fr;
          gap: 20px;
          padding: 22px;
          min-height: 100vh;
        }

        .panel {
          background: rgba(10, 16, 30, 0.88);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 18px;
          padding: 14px;
          height: calc(100vh - 44px);
          overflow-y: auto;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.03) inset;
        }

        .title {
          margin: 10px 6px 16px;
          font-size: 18px;
          font-weight: 800;
        }

        .roleSwitch {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 14px;
          background: rgba(255,255,255,0.03);
          padding: 6px;
          border-radius: 14px;
        }

        .roleSwitch button,
        .segmented button,
        .pill,
        .generateButton {
          border: none;
          cursor: pointer;
        }

        .roleSwitch button {
          background: transparent;
          color: #fff;
          border-radius: 10px;
          padding: 10px 12px;
          font-weight: 700;
        }

        .roleSwitch button.active,
        .segmented button.active,
        .pill.active {
          background: #ff7300;
          color: #fff;
          box-shadow: 0 8px 20px rgba(255, 115, 0, 0.35);
        }

        .card {
          background: linear-gradient(180deg, rgba(23, 30, 45, 0.92), rgba(16, 22, 35, 0.92));
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 18px;
          padding: 16px;
          margin-bottom: 14px;
        }

        .card h2 {
          margin: 0 0 14px;
          font-size: 14px;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: #ff7300;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 12px;
        }

        .field span {
          font-size: 13px;
          color: rgba(255,255,255,0.8);
          font-weight: 600;
        }

        .field input[type="file"],
        .field select,
        .field textarea {
          width: 100%;
          background: rgba(0,0,0,0.32);
          color: #fff;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 10px 12px;
        }

        .field textarea {
          min-height: 72px;
          resize: vertical;
        }

        .pillRow {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
        }

        .pill {
          background: rgba(255,255,255,0.05);
          color: #fff;
          border-radius: 999px;
          padding: 8px 12px;
          border: 1px solid rgba(255,255,255,0.08);
          font-weight: 700;
        }

        .ghostBox,
        .quoteBox,
        .errorBox {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 12px;
          color: rgba(255,255,255,0.86);
        }

        .quoteBox,
        .errorBox {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 14px;
        }

        .errorBox {
          margin-top: 12px;
          color: #ffb5b5;
          border-color: rgba(255, 90, 90, 0.18);
          background: rgba(255, 60, 60, 0.08);
        }

        .segmented {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .segmented button {
          background: transparent;
          color: #fff;
          border-radius: 14px;
          padding: 14px 10px;
          font-weight: 800;
          border: 1px solid rgba(255,255,255,0.06);
        }

        .rangeField {
          margin-bottom: 12px;
        }

        .rangeHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 6px;
          font-size: 14px;
        }

        .rangeHead strong {
          color: #ff9c4a;
        }

        input[type="range"] {
          width: 100%;
          accent-color: #ff7300;
        }

        .checkGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 12px;
          font-size: 14px;
        }

        .checkGrid label {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .generateButton {
          width: 100%;
          background: #ff7300;
          color: #fff;
          border-radius: 14px;
          padding: 16px 18px;
          font-weight: 900;
          font-size: 18px;
          box-shadow: 0 10px 24px rgba(255, 115, 0, 0.35);
        }

        .generateButton:disabled {
          opacity: 0.7;
          cursor: default;
        }

        .generateNote {
          text-align: center;
          margin-top: 10px;
          color: rgba(255,255,255,0.68);
          font-size: 14px;
        }

        .previewArea {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .previewFrame {
          position: relative;
          flex: 1;
          min-height: calc(100vh - 44px);
          background: rgba(5, 8, 15, 0.8);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 24px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          cursor: crosshair;
        }

        .previewImage {
          display: block;
          width: auto;
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          border-radius: 12px;
          pointer-events: none;
        }

        .emptyPreview {
          color: rgba(255,255,255,0.5);
          font-size: 18px;
        }

        .marker {
          position: absolute;
          width: 12px;
          height: 12px;
          border-radius: 999px;
          background: #ff7300;
          border: 2px solid #ffffff;
          box-shadow: 0 0 0 6px rgba(255, 115, 0, 0.18);
          pointer-events: none;
        }

        .marker.blinking {
          animation: markerBlink 1s ease-in-out infinite;
        }

        .generatingBadge {
          position: absolute;
          margin-top: -34px;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(255, 115, 0, 0.92);
          color: white;
          font-weight: 800;
          font-size: 12px;
          white-space: nowrap;
          pointer-events: none;
          animation: badgeBlink 1s ease-in-out infinite;
        }

        @keyframes markerBlink {
          0%, 100% {
            opacity: 1;
            box-shadow: 0 0 0 6px rgba(255, 115, 0, 0.18);
          }
          50% {
            opacity: 0.35;
            box-shadow: 0 0 0 12px rgba(255, 115, 0, 0.10);
          }
        }

        @keyframes badgeBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }

        .coordsBar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: rgba(255,255,255,0.68);
          font-size: 14px;
          padding: 0 6px;
        }

        .debugBlock {
          background: rgba(12, 16, 26, 0.78);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px;
          padding: 10px 12px;
        }

        .debugBlock summary {
          cursor: pointer;
          color: rgba(255,255,255,0.9);
          font-weight: 700;
        }

        .debugMask {
          display: block;
          width: 100%;
          max-width: 520px;
          margin-top: 12px;
          background: #000;
          border-radius: 10px;
        }

        .debugPrompt {
          white-space: pre-wrap;
          color: rgba(255,255,255,0.82);
          margin: 12px 0 0;
          font-size: 13px;
          line-height: 1.5;
        }

        .debugEmpty {
          color: rgba(255,255,255,0.55);
          margin-top: 12px;
        }

        @media (max-width: 1200px) {
          .page {
            grid-template-columns: 1fr;
          }

          .panel {
            height: auto;
            max-height: none;
          }

          .previewFrame {
            min-height: 60vh;
          }
        }
      `}</style>
    </>
  );
}
