# LLC Design Tool with PLECS Integration

## Files

```
src-designer/
├── index.html              # Main UI
├── app.js                  # Application logic
├── src-calculator.js       # LLC calculator
├── styles.css              # Styles
├── plecs-server.js         # PLECS backend server
├── run_plecs_simulation.m  # MATLAB script
└── SRC.plecs               # Your PLECS model (required)
```

## Quick Start

### 1. Download
```powershell
scp -r root@8.222.140.165:/home/admin/.openclaw/workspace/src/tools/src-designer %USERPROFILE%\Desktop\src-designer
```

### 2. Copy PLECS Model
Copy your `SRC.plecs` file to the downloaded folder.

### 3. Start Server
```cmd
cd %USERPROFILE%\Desktop\src-designer
node plecs-server.js
```

### 4. Run Simulation
1. Open `index.html` in browser
2. Click "Calculate"
3. Click "Run PLECS Simulation"

---

*Version 1.2.1*
