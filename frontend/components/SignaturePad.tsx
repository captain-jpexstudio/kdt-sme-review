"use client";
import { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";

import { c, radius } from "@/lib/theme";

// 듀얼 서명 — spec §8. 타이핑 성명(손글씨 폰트) + 캔버스 드로잉.
// 출력: { typedName, png(dataURL) }. 검증(공백·빈 캔버스)은 onChange로 상위에 전달.

export interface SignatureValue {
  typedName: string;
  png: string;
}

export function SignaturePad({ onChange }: { onChange: (v: SignatureValue | null) => void }) {
  const padRef = useRef<SignatureCanvas>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [typedName, setTypedName] = useState("");
  const [canvasW, setCanvasW] = useState(320);

  // 컨테이너 폭에 맞춰 캔버스 픽셀폭 조정(모바일 오버플로 방지). 리사이즈 시 캔버스가
  // 비워지므로 서명값을 무효화해 상위에 알린다.
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const next = Math.round(Math.max(240, Math.min(el.clientWidth, 520)));
      setCanvasW((prev) => {
        if (prev !== next) onChange(null);
        return next;
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [onChange]);

  const emit = (name: string) => {
    const pad = padRef.current;
    if (!name.trim() || !pad || pad.isEmpty()) {
      onChange(null);
      return;
    }
    onChange({ typedName: name.trim(), png: pad.toDataURL("image/png") });
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: c.sub }}>성명 (타이핑)</label>
      <input
        value={typedName}
        onChange={(e) => {
          setTypedName(e.target.value);
          emit(e.target.value);
        }}
        placeholder="홍길동"
        style={{ fontFamily: "'Nanum Pen Script', cursive", fontSize: 22, padding: "8px 12px", border: `1px solid ${c.line2}`, borderRadius: radius.control, background: "#fff", color: c.ink }}
      />
      <label style={{ fontSize: 12, fontWeight: 500, color: c.sub }}>서명 (마우스/터치로 드로잉)</label>
      <div ref={boxRef} style={{ border: `1px solid ${c.line2}`, borderRadius: radius.control, width: "100%", maxWidth: 360, height: 140, background: c.panel, overflow: "hidden", touchAction: "none" }}>
        <SignatureCanvas
          ref={padRef}
          penColor="#16321a"
          canvasProps={{ width: canvasW, height: 140 }}
          onEnd={() => emit(typedName)}
        />
      </div>
      <button
        type="button"
        onClick={() => {
          padRef.current?.clear();
          emit(typedName);
        }}
        style={{ width: 84, fontSize: 12.5, fontWeight: 500, padding: "6px 10px", border: `1px solid ${c.line2}`, borderRadius: radius.control, background: "#fff", color: c.sub, cursor: "pointer" }}
      >
        지우기
      </button>
    </div>
  );
}
