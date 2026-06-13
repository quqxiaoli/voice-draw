# 多阶段构建:产物为 alpine 上的静态二进制
# 注:原计划用 distroless,gcr.io 国内拉不到,改 alpine
FROM golang:1.26 AS builder
WORKDIR /src

# 国内服务器绕开墙掉的 proxy.golang.org
ENV GOPROXY=https://goproxy.cn,direct

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -o /app/server ./cmd

FROM alpine:3.20
WORKDIR /app

# HTTPS 调 DeepSeek 需要根证书
RUN apk add --no-cache ca-certificates

COPY --from=builder /app/server /app/server

EXPOSE 8080
ENTRYPOINT ["/app/server"]
