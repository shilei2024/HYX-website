# 弘易芯科技官网 - Docker 镜像
# 基于 Nginx Alpine 轻量级镜像

FROM nginx:alpine

# 设置维护者信息
LABEL maintainer="HYIC Technology <bill.zhang@hyic-tech.cn>"
LABEL description="弘易芯科技企业官网"
LABEL version="2.0"

# 复制网站文件到 Nginx 目录
COPY . /usr/share/nginx/html/

# 复制自定义 Nginx 配置（可选）
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# 设置正确的文件权限
RUN chmod -R 755 /usr/share/nginx/html && \
    chown -R nginx:nginx /usr/share/nginx/html

# 暴露 80 端口
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]