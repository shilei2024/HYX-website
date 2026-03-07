# 弘易芯科技官网 - Docker 镜像（支持 HTTPS）
# 基于 Nginx Alpine 轻量级镜像

FROM nginx:alpine

LABEL maintainer="HYIC Technology <bill.zhang@hyic-tech.cn>"
LABEL description="弘易芯科技企业官网"
LABEL version="2.0"

# 复制网站文件到 Nginx 目录
COPY . /usr/share/nginx/html/

# 复制 Nginx 配置文件
COPY nginx-docker.conf /etc/nginx/conf.d/default.conf

# 创建 SSL 目录
RUN mkdir -p /etc/nginx/ssl

# 设置正确的文件权限
RUN chmod -R 755 /usr/share/nginx/html && \
    chown -R nginx:nginx /usr/share/nginx/html

# 暴露端口
EXPOSE 80 443

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]