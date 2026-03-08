#!/bin/bash
# Watch 模式管理脚本

ACTION=$1
cd "$(dirname "$0")"

case "$ACTION" in
    start)
        echo "启动 Watch 模式..."
        docker compose watch
        ;;
    
    start-bg)
        echo "后台启动 Watch 模式..."
        nohup docker compose watch > watch.log 2>&1 &
        echo "✅ 已启动 (日志：watch.log)"
        ;;
    
    stop)
        echo "停止 Watch 模式..."
        pkill -f "docker compose watch" || true
        echo "✅ 已停止"
        ;;
    
    status)
        if pgrep -f "docker compose watch" > /dev/null; then
            echo "✅ Watch 模式运行中"
            pgrep -af "docker compose watch"
            [ -f watch.log ] && tail -n 5 watch.log
        else
            echo "❌ Watch 模式未运行"
        fi
        ;;
    
    logs)
        [ -f watch.log ] && tail -f watch.log || echo "无日志文件"
        ;;
    
    restart)
        $0 stop
        sleep 2
        $0 start-bg
        ;;
    
    *)
        echo "用法：$0 {start|start-bg|stop|status|logs|restart}"
        exit 1
        ;;
esac
