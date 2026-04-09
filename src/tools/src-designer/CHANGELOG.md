# 修改日志 | Changelog

## 2026-04-09 - 参数改动对比与拓扑模式传递

### 修复的问题

1. **LLC 谐振频率 fr_LLC 重复项**
   - 删除了对比面板中重复的 LLC 谐振频率显示块
   - 现在对比面板中只有一个 LLC 谐振频率对比项

### 功能改进

2. **页面命名统一为 LLC-SRC**
   - `index.html`: 标题从 "SRC 设计工具" 改为 "LLC-SRC 设计工具"
   - `verify.html`: 标题从 "SRC 验证工具" 改为 "LLC-SRC 验证工具"
   - 所有相关文本、footer、按钮标签均更新为 LLC-SRC

3. **拓扑模式参数传递**
   - 在设计页 (`app.js`) 的 `toggleTopology()` 函数中：
     - 添加 TopologyChange 参数存储到 sessionStorage
     - LLC 模式时 TopologyChange = 1
     - SRC 模式时 TopologyChange = 0
   
   - 在 `saveParams()` 函数中：
     - 将 TopologyChange 参数写入 llc-designer-results
   
   - 在验证页 (`verify.js`) 的 `syncFrozenParams()` 函数中：
     - 从 sessionStorage 读取 TopologyChange 参数
     - 从 results 中读取 TopologyChange 参数（如果存在）
     - 根据 TopologyChange 设置 topologyMode
   
   - 在 `buildParams()` 函数中：
     - 将 TopologyChange 参数写入 verify_input.json
     - LLC 时 TopologyChange = 1，SRC 时 TopologyChange = 0

### 修改的文件

- `/home/admin/.openclaw/workspace/src/tools/src-designer/index.html`
- `/home/admin/.openclaw/workspace/src/tools/src-designer/verify.html`
- `/home/admin/.openclaw/workspace/src/tools/src-designer/app.js`
- `/home/admin/.openclaw/workspace/src/tools/src-designer/verify.js`

### 技术细节

**TopologyChange 参数流向：**
```
设计页拓扑选择 → toggleTopology() → sessionStorage.TopologyChange
                                       ↓
                              saveParams() → llc-designer-results.TopologyChange
                                       ↓
验证页同步参数 → syncFrozenParams() → topologyMode
                                       ↓
                              buildParams() → verify_input.json.TopologyChange
```

**值定义：**
- `TopologyChange = 1`: LLC 模式（串并联谐振）
- `TopologyChange = 0`: LLC-SRC 模式（串联谐振）
