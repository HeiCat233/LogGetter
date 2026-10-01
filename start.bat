@echo off
chcp 65001 > nul
title LogGetter 跑团日志工坊
cd /d "%~dp0server"

if not exist dist\server\src\main.js (
  echo [!] 服务尚未构建，正在构建前端与后端...
  if not exist node_modules (
    echo [1/3] 安装后端依赖...
    call npm install || goto :fail
  )
  echo [2/3] 构建后端...
  call npx tsc -p tsconfig.json || goto :fail
  if not exist ..\webui\node_modules (
    echo    安装前端依赖...
    pushd ..\webui && call npm install && popd
  )
  echo [3/3] 构建前端...
  pushd ..\webui && call npm run build && popd || goto :fail
)

echo 启动服务: http://127.0.0.1:8765
start "" http://127.0.0.1:8765
node dist/server/src/main.js
goto :eof

:fail
echo [!] 构建失败，请检查上面的报错信息
pause
