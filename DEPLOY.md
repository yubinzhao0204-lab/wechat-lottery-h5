# 公网部署说明

这个抽奖 H5 包含前台、后台和 Node 服务端，不能只上传 `index.html`。服务端负责：

- 读取和保存奖品池
- 根据权重计算中奖结果
- 扣减库存
- 写入中奖记录

## 推荐方案：Render

Render 可以部署 Node Web Service，并支持 Persistent Disk。需要注意：没有持久化磁盘时，后台保存到本地文件的数据在重启或重新部署后可能丢失。Render 的 Persistent Disk 需要付费 Web Service 计划。

### 1. 上传代码

把整个项目上传到 GitHub 仓库。

### 2. 创建 Web Service

在 Render 新建 Web Service，连接这个 GitHub 仓库。

配置：

- Runtime: Node
- Build Command: 留空或填写 `npm install`
- Start Command: `npm start`
- Environment Variable:
  - `DATA_DIR=/data`

### 3. 添加 Persistent Disk

给这个 Web Service 添加磁盘：

- Mount Path: `/data`
- Size: 按需要选择，演示用 1GB 足够

### 4. 访问链接

部署成功后，Render 会给一个 HTTPS 域名：

- 前台：`https://你的服务名.onrender.com/`
- 后台：`https://你的服务名.onrender.com/admin.html`

这个前台 HTTPS 链接就可以放进微信生态里测试。

## 不推荐直接用 Vercel

Vercel 更适合静态页面和 Serverless API。当前项目依赖本地 JSON 文件保存后台配置和库存，Serverless 环境的文件写入不适合做长期数据存储。

如果要用 Vercel，需要把 `data/lottery.json` 改成数据库，比如 Supabase、Postgres、MongoDB 或云开发数据库。

## 微信生态注意事项

- 正式使用建议绑定自己的域名和 HTTPS。
- 如果要接公众号网页授权、JS-SDK、微信支付、卡券等能力，需要在微信公众平台配置业务域名、JS 接口安全域名或网页授权域名。
- 如果域名和服务器在中国大陆，通常还需要备案。
