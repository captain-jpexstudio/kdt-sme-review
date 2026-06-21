export default function AgreementPage() {
  // P1: 3-part 동의(보안서약·개인정보·세무) + 듀얼 서명 → /auth/agreement
  return (
    <main style={{ padding: 40, fontFamily: "system-ui" }}>
      <h1>동의 게이트</h1>
      <p style={{ color: "#888" }}>P1: 동의 3종 + 듀얼 서명(타이핑+캔버스) + 증빙 PDF</p>
    </main>
  );
}
