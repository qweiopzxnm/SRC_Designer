# SRC 设计工具

串联谐振变换器 (Series Resonant Converter) 自动设计工具

## 功能

- ✅ 谐振参数自动计算 (Lr, Cr, 变压器匝比)
- ✅ 器件应力分析 (MOSFET, 二极管，谐振元件)
- ✅ 增益曲线绘制 (FHA 模型)
- ✅ ZVS/ZCS 工作区域判断
- ✅ 效率估算
- ✅ Markdown 设计报告导出
- ✅ 参数本地保存

## 使用方式

### 本地运行

直接用浏览器打开 `index.html` 即可：

```bash
# 方式 1: 直接打开
open index.html

# 方式 2: 使用 Python 简易服务器
python3 -m http.server 8080
# 访问 http://localhost:8080
```

### 部署

可部署到任意静态网站托管服务：
- GitHub Pages
- Vercel
- Netlify
- 公司内部服务器

## 输入参数

| 参数 | 说明 | 单位 |
|------|------|------|
| Vin_min | 输入电压最小值 | V |
| Vin_max | 输入电压最大值 | V |
| Vo | 输出电压 | V |
| Io | 输出电流 | A |
| fs_min | 开关频率最小值 | kHz |
| fs_max | 开关频率最大值 | kHz |
| fr | 谐振频率 | kHz |
| Q_max | 最大品质因数 | - |

## 输出结果

### 谐振参数
- 变压器匝比 (n:1:1)
- 谐振电感 Lr (μH)
- 谐振电容 Cr (nF)
- 谐振频率 fr (kHz)
- 特征阻抗 Zo (Ω)
- 品质因数 Q

### 器件应力
- 原边开关管：Vds_max, I_pri_rms, I_pri_peak
- 副边整流管：Vd_max, Id_rms
- 谐振元件：Vcr_peak, Ilr_peak

### 工作特性
- ZVS/ZCS 状态判断
- ZVS 裕量
- 死区时间要求
- 估算效率

## 技术栈

- 纯前端 (HTML + CSS + JavaScript)
- 无后端依赖
- Canvas 绘制增益曲线
- LocalStorage 保存参数

## 后续扩展

- [ ] PLECS 仿真集成
- [ ] 磁件设计模块
- [ ] PCB 布局建议
- [ ] BOM 生成
- [ ] 更多拓扑支持 (LLC, CLC 等)

## 作者

小艺 ⚡ 电力电子全栈工程师助理

## 许可证

MIT
