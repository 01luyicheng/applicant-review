# 许可证选型对比 — 为何选择 MIT

> **结论**：本项目采用 **MIT (SPDX-License-Identifier: MIT)** — 见 `LICENSE`、`package.json:license`、`NOTICE`、`README.md §许可证` 与源码头 `// SPDX-License-Identifier: MIT`。MIT 是最宽松的 OSI 认证许可之一（MIT），0BSD/MIT-0 文本更短但生态认可度低于 MIT，在“商业友好 + 企业法务认可度”三角中最优解。

## 1. 对比表

| 许可证 | SPDX | OSI 认可 | 宽松度 | 专利条款 | 商标授权 | 兼容性 | 法务认可度 | 适用场景 |
|--------|------|----------|--------|----------|----------|--------|------------|----------|
| **MIT** | `MIT` | ✅ | 极宽松（仅保留版权/许可声明） | 无显式专利授权/回授 | 不授权（需另行 TRADEMARK.md） | 极高（GPL 兼容，可闭源商用） | ★★★★★ 最高 | 工具/前端库/商业友好首选 |
| **Apache-2.0** | `Apache-2.0` | ✅ | 宽松但附加专利回授与 NOTICE 义务 | ✅ 显式专利授权 + 防御性终止 | 不授权 | 高 | ★★★★☆ | 专利密集型/基金会项目 |
| **MIT-0 (MIT No Attribution)** | `MIT-0` | ✅ | 比 MIT 更宽松（无需保留声明） | 无 | 不授权 | 高 | ★★☆☆☆ 低（新、工具链识别弱） | 极简示例/公益捐献 |
| **0BSD (Zero-Clause BSD)** | `0BSD` | ✅ | 等同公有领域（仅放弃担保） | 无 | 不授权 | 高 | ★★☆☆☆ 低 | 同 MIT-0 |
| **Unlicense** | `Unlicense` | ✅ (部分法域争议) | 公有领域奉献 + 回退许可 | 无 | 不授权 | 中（德/日等法域对公有 domain 效力存疑） | ★★☆☆☆ | 个人放弃版权 |

> **更宽松的选项存在，但不更优**：`MIT-0/0BSD/Unlicense` 在文本上比 MIT 少 1 行归属义务，但丧失“需保留版权声明”这一对贡献者最轻量的署名保护，且在企业合规扫描、法务白名单、SPDX 工具链中识别度与信任度显著低于 MIT。

## 2. 为何不选 Apache-2.0

- **专利回授约束**：Apache-2.0 §3 授予专利许可但同时规定若被许可方提起专利诉讼则许可终止；对纯前端工具无实质专利风险，却增加法务审查成本与合规负担。
- **NOTICE 义务更重**：需随分发物保留 NOTICE 文件并标注修改；MIT 仅 1 句“保留版权与许可声明”。
- **结论**：MIT 已足够实现“最宽松的 OSI 认证许可之一（MIT），0BSD/MIT-0 文本更短但生态认可度低于 MIT 且商业友好”，Apache-2.0 的额外保护对本项目为负收益。

## 3. 为何不选 MIT-0 / 0BSD / Unlicense

- **MIT 是最宽松的 OSI 认证许可之一（MIT），0BSD/MIT-0 文本更短但生态认可度低于 MIT**：MIT 仅 1 个条件（保留声明），实践中与 `MIT-0/0BSD` 差异仅为是否保留声明；对用户几乎无感，却能保障贡献者署名。
- **法务与工具链**：`npm`/`GitHub`/`FOSSA`/`ScanCode` 对 `MIT` 的识别与白名单覆盖率远高于 `MIT-0/0BSD/Unlicense`；Unlicense 在部分法域（德国、日本）对“放弃版权”效力存疑，需回退到 MIT 式许可，反而增加不确定性。
- **社区预期**：前端生态（React/Vite/Tailwind 等）主流为 MIT，选择 MIT 保持与依赖一致，降低合规摩擦。
- **如需更宽松**：可在未来单独提供 `MIT-0` 双授权或 `Unlicense` 奉献，但当前以 **MIT 单许可 + 商标不授权** 为最稳妥基线；本项目已在 `TRADEMARK.md` 明确“代码 MIT、品牌不授权”，达到商业友好与品牌保护平衡。

## 4. 本项目落地

- **三处一致**：`LICENSE` 头部 `SPDX-License-Identifier: MIT` + `package.json:license="MIT"` + `README.md §许可证` 明确 MIT + 商标指向 `TRADEMARK.md`。
- **NOTICE 对齐 SBOM**：`NOTICE` 第三方清单与 `package-lock.json` 全量 `license` 字段核对，补齐 `i18next`/`react-i18next`（MIT）、`xlsx`（Apache-2.0）、`lucide-react`（ISC）等，`npm run build && npx @cyclonedx/cyclonedx-npm --output-file sbom.json` 可复验。
- **源码头**：`src/main.tsx`、`src/App.tsx` 已加 `// SPDX-License-Identifier: MIT`；后续新增文件沿用同头。
- **YOUR_ORG 占位**：`package.json` 的 `homepage/repository/bugs` 仍为 `YOUR_ORG` 历史占位，已在 `package.json#_comment_rebrand` 与 `README` 声明“发布前执行 `scripts/rebrand.sh YOUR_ORG` 替换，不影响 MIT 许可效力”，商标见 `TRADEMARK.md`。

## 5. 参考

- OSI 许可列表：https://opensource.org/licenses
- SPDX 标识：https://spdx.org/licenses/
- GitHub Choose a License — MIT：https://choosealicense.com/licenses/mit/
- Apache-2.0 专利条款解读：https://www.apache.org/licenses/LICENSE-2.0

---
*维护：若法务要求“零归属”可评估增设 MIT-0 双授权；当前 MIT 单许可为企业最易过审方案。*
