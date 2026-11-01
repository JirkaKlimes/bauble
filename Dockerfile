FROM node:22-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --ignore-scripts
COPY web/ ./
RUN npm run build

FROM alpine:3.22
ARG PB_VERSION=0.39.11
ARG TARGETARCH
RUN apk add --no-cache ca-certificates tzdata \
 && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH:-amd64}.zip" -O /tmp/pb.zip \
 && unzip -q /tmp/pb.zip pocketbase -d /usr/local/bin \
 && rm /tmp/pb.zip \
 && adduser -D -H -u 10001 bauble && mkdir /data && chown bauble:bauble /data
COPY pb_hooks /app/pb_hooks
COPY pb_migrations /app/pb_migrations
COPY --from=web /web/dist /app/pb_public
USER bauble
VOLUME /data
EXPOSE 8090
# `docker compose run --rm bauble invite admin Alex` reuses these flags
ENTRYPOINT ["pocketbase", "--dir=/data", "--hooksDir=/app/pb_hooks", "--migrationsDir=/app/pb_migrations", "--publicDir=/app/pb_public", "--automigrate=false", "--hooksWatch=false"]
CMD ["serve", "--http=0.0.0.0:8090"]
