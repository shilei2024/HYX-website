#!/bin/bash
# 弘易芯科技官网 - Docker 部署脚本
# 使用方法: ./docker-deploy.sh [build|start|stop|restart|logs|status]

set -e

IMAGE_NAME="hyx-website"
CONTAINER_NAME="hyx-website"
PORT=80

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 构建镜像
build() {
    log_info "正在构建 Docker 镜像..."
    docker build -t ${IMAGE_NAME}:latest .
    log_info "镜像构建完成: ${IMAGE_NAME}:latest"
}

# 启动容器
start() {
    if [ "$(docker ps -q -f name=${CONTAINER_NAME})" ]; then
        log_warn "容器已在运行中"
        return
    fi
    
    if [ "$(docker ps -aq -f name=${CONTAINER_NAME})" ]; then
        log_info "正在启动已存在的容器..."
        docker start ${CONTAINER_NAME}
    else
        log_info "正在启动新容器..."
        docker run -d \
            --name ${CONTAINER_NAME} \
            --restart unless-stopped \
            -p ${PORT}:80 \
            -e TZ=Asia/Shanghai \
            ${IMAGE_NAME}:latest
    fi
    
    log_info "容器已启动，访问地址: http://localhost:${PORT}"
}

# 停止容器
stop() {
    if [ "$(docker ps -q -f name=${CONTAINER_NAME})" ]; then
        log_info "正在停止容器..."
        docker stop ${CONTAINER_NAME}
        log_info "容器已停止"
    else
        log_warn "容器未运行"
    fi
}

# 重启容器
restart() {
    log_info "正在重启容器..."
    docker restart ${CONTAINER_NAME} 2>/dev/null || {
        stop
        start
    }
    log_info "容器已重启"
}

# 查看日志
logs() {
    docker logs -f --tail 100 ${CONTAINER_NAME}
}

# 查看状态
status() {
    if [ "$(docker ps -q -f name=${CONTAINER_NAME})" ]; then
        log_info "容器状态: 运行中"
        docker ps -f name=${CONTAINER_NAME} --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    elif [ "$(docker ps -aq -f name=${CONTAINER_NAME})" ]; then
        log_warn "容器状态: 已停止"
    else
        log_warn "容器不存在"
    fi
}

# 使用 Docker Compose 部署
compose_up() {
    log_info "使用 Docker Compose 启动服务..."
    docker compose up -d --build
    log_info "服务已启动"
}

compose_down() {
    log_info "停止 Docker Compose 服务..."
    docker compose down
    log_info "服务已停止"
}

# 显示帮助
show_help() {
    echo "弘易芯科技官网 - Docker 部署脚本"
    echo ""
    echo "使用方法: $0 [命令]"
    echo ""
    echo "命令列表:"
    echo "  build       构建 Docker 镜像"
    echo "  start       启动容器"
    echo "  stop        停止容器"
    echo "  restart     重启容器"
    echo "  logs        查看容器日志"
    echo "  status      查看容器状态"
    echo "  up          使用 Docker Compose 启动"
    echo "  down        停止 Docker Compose 服务"
    echo "  help        显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 build    # 构建镜像"
    echo "  $0 start    # 启动服务"
    echo "  $0 logs     # 查看日志"
}

# 主入口
case "$1" in
    build)
        build
        ;;
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    logs)
        logs
        ;;
    status)
        status
        ;;
    up)
        compose_up
        ;;
    down)
        compose_down
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        if [ -z "$1" ]; then
            show_help
        else
            log_error "未知命令: $1"
            show_help
            exit 1
        fi
        ;;
esac