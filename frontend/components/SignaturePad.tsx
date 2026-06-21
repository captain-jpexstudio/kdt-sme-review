"use client";
import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";

// 듀얼 서명 — spec §8. 타이핑 성명(손글씨 폰트) + 캔버스 드로잉.
// 출력: { typedName, png(dataURL) }. 검증(공백·빈 캔버스)은 onChange로 상위에 전달.

export interface SignatureValue {
  typedName: string;
  png: string;
}

export function SignaturePad({ onChange }: { onChange: (v: SignatureValue | null) => void }) {
  const padRef = useRef<SignatureCanvas>(null);
  const [typedName, setTypedName] = useState("");

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
      <label style={{ fontSize: 12, color: "#666" }}>성명 (타이핑)</label>
      <input
        value={typedName}
        onChange={(e) => {
          setTypedName(e.target.value);
          emit(e.target.value);
        }}
        placeholder="홍길동"
        style={{ fontFamily: "'Nanum Pen Script', cursive", fontSize: 22, padding: "6px 10px", border: "1px solid #ccc", borderRadius: 6 }}
      />
      <label style={{ fontSize: 12, color: "#666" }}>서명 (마우스/터치로 드로잉)</label>
      <div style={{ border: "1px solid #ccc", borderRadius: 6, width: 320, height: 140 }}>
        <SignatureCanvas
          ref={padRef}
          penColor="#111"
          canvasProps={{ width: 320, height: 140 }}
          onEnd={() => emit(typedName)}
        />
      </div>
      <button
        type="button"
        onClick={() => {
          padRef.current?.clear();
          emit(typedName);
        }}
        style={{ width: 80, fontSize: 12, padding: "4px 8px", border: "1px solid #ccc", borderRadius: 6, background: "#fff" }}
      >
        지우기
      </button>
    </div>
  );
}
