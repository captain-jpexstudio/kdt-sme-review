"use client";
import { useState } from "react";

import { c, radius, shadow } from "@/lib/theme";

// PAGES가 초기화 시점에 참조하므로 상단 선언(TDZ 방지).
const para: React.CSSProperties = { fontSize: 14, lineHeight: 1.8, color: c.sub, margin: 0 };
const quote: React.CSSProperties = { fontSize: 14.5, fontWeight: 700, color: c.brandText, background: c.brandTint, borderRadius: radius.control, padding: "12px 14px", margin: "4px 0 0", lineHeight: 1.6 };

// 검수 착수 전 브리핑(수정사항 #4). 다중 페이지 → 마지막 '시작하기'.
// /guide(검수 가이드) 페이지가 동일 콘텐츠를 문서형으로 재사용한다.
export const BRIEFING_PAGES: { title: string; body: React.ReactNode }[] = [
  {
    title: "국방 데이터셋 검수 브리핑",
    body: (
      <>
        <p style={para}>
          안녕하세요. 국방 특화 AI 모델의 성능 검증을 위한 데이터셋 검수 작업에 참여해 주신 영관장교 연구위원 여러분께
          진심으로 감사드립니다. 본 데이터셋은 대한민국 국군의 미래 국방 지능화 및 AI 역량 평가를 위한 핵심 자산으로
          활용될 예정입니다.
        </p>
        <p style={para}>효과적이고 정확한 검수를 위해 아래의 브리핑 및 지침을 반드시 확인해 주시기 바랍니다.</p>
      </>
    ),
  },
  {
    title: "1. 데이터셋 개요 및 구축 목적",
    body: (
      <>
        <Item label="'합동(Joint)' 개념 중심의 설계">
          본 데이터셋은 각 군의 합동과정(소령급 이상 영관장교 대상) 교육과정을 기반으로 도출된 핵심 문항과 정답으로
          구성되어 있습니다.
        </Item>
        <Item label="AI(LLM) 종합 역량 평가">
          단순한 지식 회상(Knowledge)을 넘어, 군사적 전술 판단 및 인과 관계를 분석하는 논리성(Reasoning), 화력·제원·통계를
          계산하는 수리계산능력(Math)을 복합적으로 평가하도록 설계되었습니다.
        </Item>
        <Item label="도메인별 문항 배분">
          위원님들의 군별 전문성을 극대화할 수 있도록 특기 분야(육·해·공·해병의 전투/비전투) 문항을 우선 배치하였으며,
          전 군 공통 합동 도메인 문항 역시 균형 있게 분배되었습니다.
        </Item>
      </>
    ),
  },
  {
    title: "2. 영역별 검수 착안 사항",
    body: (
      <>
        <Item label="💡 지식(Knowledge) 영역">
          제시된 국방 교리, 규정, 장비 제원 등의 사실관계가 현행 교리와 일치하는지 확인합니다. 제시된
          '해설(Rationale/CoT)'을 참고하시면 됩니다.
        </Item>
        <Item label="🧠 논리성(Reasoning) 및 수리(Math) 영역">
          작전 상황이나 수치 계산 문항의 경우, 위원님의 평소 실무 영역과 다소 상이하거나 생소할 수 있습니다. 다만 본
          문항들은 AI의 고차원적 전술 추론과 계산 메커니즘을 측정하기 위한 것이기 때문에 제시된 '해설(Rationale/CoT)'의
          정당성과 논리적 흐름이 타당한지를 중점적으로 검토해 주시기 바랍니다.
        </Item>
      </>
    ),
  },
  {
    title: "3. 핵심 검수 방법 및 프로세스",
    body: (
      <>
        <Item label="1단계 · 기본 적합성 검증">
          제공된 문항(Question)에 대해 정답(Answer)과 해설이 명확하고 정확하게 매칭되어 있는지 검인합니다. 문항 형식이
          '객관식(mcq)' 및 '주관식(short)'인 경우, 제시된 정답이 올바른지 확인합니다.
        </Item>
        <Item label="2단계 · 복합형(Complex) 문항의 적극적 교정 (★필수)">
          문항 형식이 '복합형(Complex)'인 경우, 제시된 정답에 대해 패러프레이징(문장 재구성), 전문 용어 교정, 단어 변경 등
          <b> 최소 1단어 이상의 편집을 반드시 수행</b>하셔야 검수를 완료할 수 있습니다.
        </Item>
        <Item label="3단계 · 부적절 문항 처리 (불가/Reject)">
          본 문항들은 국방 데이터를 바탕으로 AI가 출제하였습니다. 만약 문항 자체의 오류가 심각해 활용이 불가능하다고
          판단되는 경우, <b>[폐기(불가)]</b> 버튼을 누르고 사유를 간략히 기재해 주십시오. 해당 문항은 제외되며, 이를
          대체할 새로운 예비(Reserved) 문항이 자동으로 배정됩니다.
        </Item>
        <Item label="4단계 · 문항 전처리 (필요시)">
          AI 추출 과정에서 문항 내 오지선다가 포함된 경우, 수정 질문 내 텍스트 박스에서 오지선다 내용을 삭제하고, 실제
          문제만 남길 수 있도록 수정해 주십시오.
        </Item>
      </>
    ),
  },
  {
    title: "4. 행정 사항 및 최종 제출",
    body: (
      <>
        <Item label="상시 저장 기능">
          검수 작업은 실시간 또는 중간 저장이 가능하므로 편하신 시간에 분할하여 진행하실 수 있습니다.
        </Item>
        <Item label="최종 검토">
          최종 [제출하기]를 누르시기 전에, 검수 완료하신 문항들을 다시 한번 확인해 주시기 바랍니다.
        </Item>
        <Item label="자문료 지급">
          모든 문항의 검수 및 제출이 완료되면 화면의 안내에 따라 자문료 지급을 위한 계좌 정보 및 필요 서류를 입력해 주시면
          행정 절차가 마무리됩니다.
        </Item>
        <p style={quote}>"위원님들의 정밀한 검수가 대한민국 미래 국방 AI의 신뢰성을 좌우합니다."</p>
        <p style={para}>작업 중 문의 사항이 있으신 경우 언제든 운영사무국으로 연락해 주시기 바랍니다. 감사합니다.</p>
      </>
    ),
  },
];

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={item}>
      <b style={itemLabel}>{label}</b>
      <span style={itemText}>{children}</span>
    </div>
  );
}

export function Briefing({ onDone }: { onDone: () => void }) {
  const [page, setPage] = useState(0);
  const last = page === BRIEFING_PAGES.length - 1;
  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={head}>
          <span style={brand}>검수 브리핑</span>
          <span style={counter}>{page + 1} / {BRIEFING_PAGES.length}</span>
        </div>
        <h2 style={title}>{BRIEFING_PAGES[page].title}</h2>
        <div style={content}>{BRIEFING_PAGES[page].body}</div>
        <div style={foot}>
          <button style={page === 0 ? ghostOff : ghost} onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            이전
          </button>
          {last ? (
            <button style={primary} onClick={onDone}>시작하기</button>
          ) : (
            <button style={primary} onClick={() => setPage((p) => Math.min(BRIEFING_PAGES.length - 1, p + 1))}>다음 페이지</button>
          )}
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,20,25,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 60 };
const modal: React.CSSProperties = { width: "100%", maxWidth: 640, maxHeight: "88vh", display: "flex", flexDirection: "column", background: c.surface, borderRadius: radius.card, boxShadow: shadow.pop, padding: "26px 30px" };
const head: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center" };
const brand: React.CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: 1, color: c.brand };
const counter: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: c.faint };
const title: React.CSSProperties = { fontSize: 20, fontWeight: 700, margin: "10px 0 16px", letterSpacing: "-0.3px", color: c.ink };
const content: React.CSSProperties = { overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, paddingRight: 4 };
const item: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 5, paddingLeft: 13, borderLeft: `2px solid ${c.brandBorder}` };
const itemLabel: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: c.ink };
const itemText: React.CSSProperties = { fontSize: 13.5, lineHeight: 1.75, color: c.sub };
const foot: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${c.line}` };
const primary: React.CSSProperties = { height: 40, padding: "0 22px", borderRadius: radius.control, border: "1px solid transparent", background: c.brand, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", marginLeft: "auto" };
const ghost: React.CSSProperties = { height: 40, padding: "0 18px", borderRadius: radius.control, border: `1px solid ${c.line2}`, background: "#fff", color: c.ink, fontSize: 14, fontWeight: 500, cursor: "pointer" };
const ghostOff: React.CSSProperties = { ...ghost, color: c.faint, cursor: "not-allowed", background: c.panel };
