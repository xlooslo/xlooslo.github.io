# Seungyong Lee — personal site

순수 HTML/CSS/JavaScript로 만든 정적 사이트입니다. 빌드 도구나 설치가 필요 없고, GitHub Pages에 그대로 올리면 됩니다.

```
index.html              페이지 본문 (논문, 연구 분야, 경력, 학력이 모두 여기에 있음)
assets/css/style.css    색, 글꼴, 레이아웃 (맨 위 변수만 바꾸면 전체 색이 바뀜)
assets/js/molecule.js   히어로의 3D 분자 (분자 좌표 + 그리기 코드)
assets/js/main.js       다크 모드 버튼, 논문 필터
assets/img/             프로필 사진, 파비콘
assets/figures/         (2차) 직접 만든 figure를 넣을 폴더
assets/slides/          (2차) PPT에서 내보낸 PDF나 이미지를 넣을 폴더
```

## 1. 처음 배포하기

1. GitHub에서 새 저장소(repository, 파일을 모아두는 폴더)를 만듭니다.
   이름은 반드시 `<GitHub아이디>.github.io`, 공개(Public)로 설정합니다.
2. 이 폴더 안의 파일 전체를 저장소 맨 위(루트)에 올립니다. `index.html`이 맨 위에 있어야 합니다.

   ```bash
   git init
   git add .
   git commit -m "Initial site"
   git branch -M main
   git remote add origin https://github.com/<GitHub아이디>/<GitHub아이디>.github.io.git
   git push -u origin main
   ```
3. 저장소의 Settings → Pages → Source를 `Deploy from a branch`로 두고, Branch는 `main` / `(root)`를 선택한 뒤 Save.
4. 1~2분 뒤 `https://<GitHub아이디>.github.io` 에서 열립니다.

수정할 때는 파일을 고치고 `git add . && git commit -m "update" && git push` 하면 몇 분 안에 반영됩니다.

## 2. 내 컴퓨터에서 미리보기

`index.html`을 더블클릭하면 열립니다. 글꼴(Google Fonts)은 인터넷이 연결되어 있어야 보입니다.
주소창으로 확인하고 싶으면 이 폴더에서 `python3 -m http.server 8000` 실행 후 `http://localhost:8000`.

## 3. 자주 하는 수정

| 하고 싶은 일 | 어디를 고치나 |
|---|---|
| 논문 추가 | `index.html`의 Publications에서 `<article class="pub">` 블록 하나를 복사해 붙여넣기. 제1저자면 `data-role="first"`, 공저자면 `data-role="co"` |
| 논문에 링크 달기 | 그 논문의 `.pub-main` 안에 `<p class="pub-links"><a href="URL">Paper</a> <a href="URL">Code</a></p>` 추가 |
| GitHub / CV 버튼 보이기 | 맨 위 링크 목록의 `<li hidden>` 두 개에서 `href="#"`를 실제 주소로 바꾸고 `hidden`을 지움 |
| 색 바꾸기 | `style.css` 맨 위 `:root`의 `--accent` 등 (다크 모드 값은 아래 두 블록) |
| 히어로 분자 바꾸기 | `molecule.js`의 `MOL`. 아래 RDKit 코드로 좌표를 새로 만들 수 있음 |

### 분자 좌표 새로 만들기 (RDKit)

```python
from rdkit import Chem
from rdkit.Chem import AllChem
import numpy as np

m = Chem.AddHs(Chem.MolFromSmiles("NC(=O)CCSSC(C)(C)CCC(=O)O"))   # 원하는 SMILES
AllChem.EmbedMolecule(m, randomSeed=11); AllChem.MMFFOptimizeMolecule(m)
m = Chem.RemoveHs(m)
pos = np.array(m.GetConformer().GetPositions()); pos -= pos.mean(axis=0)
# 원소: [a.GetSymbol() for a in m.GetAtoms()]
# 결합: [[b.GetBeginAtomIdx(), b.GetEndAtomIdx(), int(b.GetBondTypeAsDouble())] for b in m.GetBonds()]
# ss: 하이라이트할 두 황(S) 원자의 인덱스
```

## 4. 공개 전에 확인할 것

- 전화번호는 공개 사이트에 넣지 않았습니다. CV PDF를 올릴 거라면 전화번호를 지운 버전을 올리세요.
- 아직 게재되지 않은 세 항목(ICML 2027 투고 예정, ACL ARR, ICLR 2027)은 제목과 설명 없이 연구 분야 키워드만 적었습니다. 논문이 채택되면 정식 제목과 초록으로 바꾸세요.
- ACL ARR은 제출 때 "binding no non-anonymous preprint" 옵션을 골랐다면 메타리뷰가 나올 때까지 프리프린트를 공개할 수 없습니다. 제출 양식에서 어느 옵션을 골랐는지 확인하세요.
- 공개 범위는 공저자와 지도교수에게도 한 번 확인하세요.
