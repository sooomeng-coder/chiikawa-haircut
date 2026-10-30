// 실제 그림이 준비되면 경로를 넣는다. null이면 코드로 그린 임시 그림을 쓴다.
// 모든 그림은 같은 크기의 정사각형(권장 1024×1024), 배경 투명 PNG, 같은 위치에 맞춰 그린다.
// 자세한 규격은 assets/README.md 참고.
window.HAIRCUT_ASSETS = {
  hairFull: null, // 'assets/hair-full.png' — 털 많은 몸 (얼굴 없이)
  hairCut: null,  // 'assets/hair-cut.png'  — 털 다 자른 몸 (얼굴 없이)
  faces: {
    cry: null,    // 처음 — 울상
    calm: null,   // 절반쯤 잘랐을 때 — 진정
    relief: null, // 거의 다 잘랐을 때 — 안심
    endure: null, // 자르는 중 — 꾹 참기
    shock: null,  // 바리깡 켰을 때 — 깜짝
    happy: null,  // 쓰다듬을 때 — 기분 좋음
    done: null,   // 완성 — 활짝 웃음
  },
};
