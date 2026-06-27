# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Backend Architecture (Code/anno/)

The backend is a Django 6.0 project using **Django Ninja Extra** (not DRF) with django-ninja-jwt for authentication. All API endpoints are auto-discovered from controller classes decorated with `@api_controller`.

### Tech stack

| Layer | Choice |
|---|---|
| Framework | Django 6.0 + django-ninja-extra 0.31 |
| Auth (humans) | django-ninja-jwt (access 30 min, refresh 7 days, HS256) |
| Auth (machines) | Per-project API keys via `X-API-Key` header |
| Database | PostgreSQL 18, accessed via Django ORM |
| Object storage | S3-compatible (RustFS) via django-storages |
| Images | Pillow, thumbnail cache via custom `TempFileCache` |
| Reverse proxy | Caddy (routes `/api/*` to Django, serves static/thumbnail/original-image paths) |
| Python | 3.14, managed with uv |

### Services (Docker)

```
docker/postgres/    → PostgreSQL 18 (db: anno, user: postgres, pass: postgres)
docker/rustfs/      → S3-compatible object store on port 9000
docker/caddy/       → Reverse proxy on :80/:443
anno/ (Django)      → Run locally via `python manage.py runserver 0.0.0.0:8000`
```

### Django apps

| App | Purpose |
|---|---|
| `anno_users` | Custom `User` model (extends `AbstractUser`), register, profile |
| `anno_projects` | `Project`, `ProjectMembership`, `ProjectAPIKey` models + CRUD controllers |
| `anno_images` | `Image2D`, `Annotation2D`, subtype models (`Box2D`, `Polygon2D`, `Keypoint2D`), `Operation` |
| `anno_infers` | Inference worker API — project-key auth, batch annotation submission |

### API routing

Django Ninja auto-discovers controllers. All routes live under `/api/`:

```
/api/token/pair          POST   — JWT login
/api/token/refresh       POST   — JWT refresh
/api/token/verify        POST   — JWT verify
/api/users/register      POST   — public registration
/api/users/me            GET    — current user profile
/api/projects/           GET    — list user's projects (includes my_role)
/api/projects/           POST   — create project
/api/projects/{id}       GET    — project detail
/api/projects/{id}       PATCH  — update project (supervisor only)
/api/projects/{id}       DELETE — delete project (supervisor only)
/api/projects/{id}/members/*     — member CRUD (supervisor only)
/api/projects/{id}/api-keys/*    — API key management (supervisor only)
/api/projects/{id}/images/       GET/POST — list/upload images
/api/projects/{id}/images/{id}/original_image   GET — download original
/api/projects/{id}/images/{id}/thumbnail_image  GET — thumbnail (?w=&h=)
/api/projects/{id}/images/{id}/annotations/     GET/POST — list/create
/api/projects/{id}/images/{id}/annotations/{id} GET/PATCH/DELETE
/api/projects/{id}/images/{id}/operations/      GET — audit trail (read-only)
/api/infers/project/meta         GET — project meta (API key auth)
/api/infers/project/images       GET — paginated image list (API key auth)
/api/infers/project/annotations  POST — batch AI annotation submit (API key auth)
```

### Critical backend patterns (must understand for frontend work)

1. **Immutable annotations** — `PATCH /annotations/{id}` does NOT update the row. It sets `is_active=False` on the old annotation, creates a brand-new row, and writes an `Operation(action="modify")` linking old→new. The frontend receives the NEW annotation's ID and must swap it in locally.

2. **Denormalized `project_id`** on `Annotation2D` — set automatically by a `pre_save` signal from `image.project_id`. The frontend never sends `project_id` in annotation payloads.

3. **`my_role` is computed per-request** — from `ProjectMembership`. Admin group members always get `"admin"`. Non-members get `null`. Always lowercase-normalize before comparing.

4. **Image serving differs by DEBUG** — In `DEBUG=true`, Django streams bytes directly. In production, Django returns a 307 redirect to a Caddy-proxied presigned S3 URL. The frontend uses `fetch` with credentials; the response is either the raw image or a redirect the browser follows.

5. **Thumbnail dimensions clamped** to [50, 800] server-side. Pass `?w=300&h=300`.

6. **Operation history is append-only** — no update or delete endpoints exist. Do NOT implement rollback/undo/redo.

7. **Dual auth paths** — Human users use JWT (`Authorization: Bearer <access>`). Inference workers use API keys (`X-API-Key: ak_xxxx.yyyy`). The frontend only uses JWT.

8. **Project creator is NOT auto-added as member** — The creator must be explicitly added via the members endpoint, or they won't see the project in `GET /projects/` (unless they're admin).

### Running the backend

```bash
cd Code/anno

# Start infrastructure
docker compose -f docker/postgres/docker-compose.yml up -d
docker compose -f docker/rustfs/docker-compose.yml up -d
docker compose -f docker/caddy/docker-compose.yml up -d

# Run Django
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

### Running backend tests

```bash
cd Code/anno
python manage.py test                    # all tests
python manage.py test anno_projects      # project + API key tests
python manage.py test anno_infers        # inference API tests
```

### Scaffolding the frontend (this repo)

```bash
cd Code/anno-web
npm create vite@latest . -- --template react-ts   # first time only
npm install
npm install react-router @react-router/dev axios zustand ol
npm install -D tailwindcss @tailwindcss/vite
```

### Environment variables (frontend .env)

```
VITE_API_BASE_URL=http://localhost:8000
```

If served behind the same Caddy instance, set to empty string and use relative paths `/api/...`.

---

## 项目目标

本项目需要构建一个基于后端 `openapi.json` 和真实后端代码的 2D 图像标注 WebUI。该 WebUI 面向项目制图像标注场景，核心功能包括：

* 用户登录
* Project 列表
* 按角色区分 supervisor project 和 worker project
* Project supervisor 上传图片
* Project supervisor 编辑 project meta info
* Project supervisor 编辑 label mapping
* Project worker 只能标注，不能修改项目信息
* 图像标注界面
* 支持 box、polygon、keypoint 三种标注
* 支持查看 operation history
* 第一版不实现 operation rollback / undo / redo
* 标注界面采用 map-based annotation 架构，为后续 WSI / 超大图 / 瓦片图预留扩展能力

本文件用于指导 Agent 实现前端。Agent 必须严格遵守本文档，不要自行发明不存在的后端接口。

---

## 一、实现前必须先分析真实代码

不要只依赖 `openapi.json`。所有核心 API 类型、权限逻辑、字段语义都必须同时参考真实代码。

后端项目路径：

```text
Code/anno/
```

实现前必须分析 `Code/anno/` 中和以下对象相关的代码：

```text
Project
Image2D
Annotation2D
Operation
User
JWTAuth
label_mapping
meta_info
supervisor
worker
```

需要重点搜索和分析：

```text
Project
ProjectOutput
ProjectCreateInput
ProjectUpdateInput
Image2D
Image2DOutput
Annotation2D
Annotation2DCreateInput
Annotation2DOutput
OperationOutput
label_mapping
meta_info
my_role
supervisor
worker
JWTAuth
```

分析目标：

1. 找到 Project 模型、schema、router/view 实现
2. 找到 Image2D 模型、schema、router/view 实现
3. 找到 Annotation2D 模型、schema、router/view 实现
4. 找到 Operation/history 的模型、schema、router/view 实现
5. 找到 supervisor / worker 的真实权限判断逻辑
6. 找到 `label_mapping` 的真实存储结构
7. 找到 `meta_info` 的真实存储结构
8. 对照 `openapi.json`，确认类型是否一致
9. 如果真实代码和 OpenAPI 不一致，以真实代码为准
10. 如果发现 OpenAPI 暴露了接口但真实代码行为不同，在最终说明中列出差异

Agent 不得在未分析真实代码的情况下直接开始写前端核心类型。

---

## 二、技术栈要求

如果项目已有前端技术栈，优先沿用现有项目结构。

如果需要新建前端，默认使用：

```text
React
TypeScript
Vite
React Router
React Router file-based routes
OpenLayers
Axios 或 fetch
Zustand 或 React Context
Tailwind CSS 或 CSS Modules
```

标注界面不要使用普通 Canvas 作为核心方案。优先使用 OpenLayers 构建 map-based annotation。

---

## 三、路由要求：file-based router

React Router 必须优先使用 file-based routes，不要写一个大型集中式 routes array。

推荐结构：

```text
app/
  root.tsx
  routes.ts
  routes/
    _index.tsx

    _auth.tsx
    _auth.login.tsx
    _auth.register.tsx

    _app.tsx
    _app.projects._index.tsx
    _app.projects.$projectId.tsx
    _app.projects.$projectId.settings.tsx
    _app.projects.$projectId.images._index.tsx
    _app.projects.$projectId.images.$imageId.annotate.tsx
```

URL 映射：

```text
/                                      -> routes/_index.tsx
/login                                 -> routes/_auth.login.tsx
/register                              -> routes/_auth.register.tsx

/projects                              -> routes/_app.projects._index.tsx
/projects/:projectId                   -> routes/_app.projects.$projectId.tsx
/projects/:projectId/settings          -> routes/_app.projects.$projectId.settings.tsx
/projects/:projectId/images            -> routes/_app.projects.$projectId.images._index.tsx
/projects/:projectId/images/:imageId/annotate
                                       -> routes/_app.projects.$projectId.images.$imageId.annotate.tsx
```

`_auth.tsx` 是登录、注册页面布局。

`_app.tsx` 是登录后的主布局，需要包含：

* 顶部导航栏
* 当前用户信息
* 退出登录按钮
* 登录态检查
* `<Outlet />`

所有需要登录的页面必须放在 `_app` 路由组下。

---

## 四、认证流程

### 登录接口

```text
POST /api/token/pair
```

请求体：

```json
{
  "username": "string",
  "password": "string"
}
```

响应体：

```json
{
  "username": "string",
  "access": "string",
  "refresh": "string"
}
```

登录成功后：

1. 保存 `access`
2. 保存 `refresh`
3. 保存 username
4. 跳转 `/projects`

后续所有 JWT 接口请求需要自动附加请求头：

```text
Authorization: Bearer <access>
```

### 刷新 token

```text
POST /api/token/refresh
```

请求体：

```json
{
  "refresh": "string"
}
```

响应体：

```json
{
  "access": "string | null",
  "refresh": "string"
}
```

API client 必须支持：

* 请求前自动带 access token
* 遇到 401 自动尝试 refresh
* refresh 成功后重放原请求
* refresh 失败后清空登录状态并跳转 `/login`

### 校验 token

```text
POST /api/token/verify
```

可选实现。页面初始化时可以通过 `/api/users/me` 判断登录态。

### 当前用户

```text
GET /api/users/me
```

用于获取当前用户信息，并显示在顶部导航栏。

### 注册

```text
POST /api/users/register
```

请求体：

```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

注册页可以实现，但不是第一优先级。

---

## 五、API Client 设计

必须封装统一 API 层，不允许在组件中到处手写 `fetch`。

推荐目录：

```text
app/api/
  client.ts
  auth.ts
  users.ts
  projects.ts
  images.ts
  annotations.ts
  operations.ts
```

`client.ts` 负责：

* base URL
* JSON 请求
* multipart/form-data 上传
* blob 图片读取
* JWT header
* 401 refresh
* refresh 失败退出登录
* 错误对象统一格式化

环境变量：

```text
VITE_API_BASE_URL=http://localhost:8000
```

如果后端和前端同域部署，可以允许 `VITE_API_BASE_URL` 为空，并使用相对路径 `/api/...`。

---

## 六、核心 TypeScript 类型

类型来源优先级：

1. 真实后端代码中的 model / schema / serializer / response schema
2. `openapi.json`
3. 前端已有类型
4. Agent 推断

推荐类型文件：

```text
app/types/
  api.ts
  auth.ts
  user.ts
  project.ts
  image.ts
  annotation.ts
  operation.ts
```

### Auth 类型

```ts
export interface TokenObtainPairInput {
  username: string
  password: string
}

export interface TokenObtainPairOutput {
  username: string
  access: string
  refresh: string
}

export interface TokenRefreshInput {
  refresh: string
}

export interface TokenRefreshOutput {
  access: string | null
  refresh: string
}
```

### User 类型

```ts
export interface UserProfile {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  is_active: boolean
  groups: string[]
}
```

### Project 类型

```ts
export type ProjectRole = "supervisor" | "worker" | string

export interface Project {
  id: number
  name: string
  description: string
  meta_info: Record<string, any>
  label_mapping: Record<string, any>
  created_by_id: number
  my_role: ProjectRole | null
  created_at: string
  updated_at: string
}

export interface ProjectCreateInput {
  name: string
  description?: string
  meta_info?: Record<string, any>
  label_mapping?: Record<string, any>
}

export interface ProjectUpdateInput {
  name?: string | null
  description?: string | null
  meta_info?: Record<string, any> | null
  label_mapping?: Record<string, any> | null
}
```

### Image 类型

```ts
export interface Image2D {
  id: number
  project_id: number
  image_url: string
  thumbnail_url: string
  file_name: string
  width: number | null
  height: number | null
  created_at: string
  updated_at: string
}
```

### Annotation 类型

```ts
export type AnnotationType = "box" | "polygon" | "keypoint"

export interface Box2DDataInput {
  x: number
  y: number
  width: number
  height: number
  rotation?: number
}

export interface Polygon2DDataInput {
  points: number[][]
}

export interface Keypoint2DDataInput {
  points: number[][]
}

export interface Annotation2DCreateInput {
  annotation_type: AnnotationType | string
  label?: number | null
  box?: Box2DDataInput | null
  polygon?: Polygon2DDataInput | null
  keypoint?: Keypoint2DDataInput | null
}

export interface Annotation2DOutput {
  id: number
  image_id: number
  project_id: number
  annotation_type: AnnotationType | string
  label: number | null
  is_active: boolean
  data: Record<string, any>
  created_at: string
  updated_at: string
}
```

### Operation 类型

```ts
export interface OperationOutput {
  id: number
  image_id: number
  from_annotation_id: number | null
  to_annotation_id: number | null
  action: string
  performed_by_id: number
  created_at: string
}
```

---

## 七、Project 页面

路径：

```text
/projects
```

接口：

```text
GET /api/projects/
```

页面目标：

登录后进入 Project 页面。Project 页面必须按角色分组：

```text
Supervisor Projects
Worker Projects
```

分组逻辑：

```ts
const role = project.my_role?.toLowerCase()

if (role === "supervisor") {
  supervisorProjects.push(project)
}

if (role === "worker") {
  workerProjects.push(project)
}
```

如果 role 为空或未知，可以放到：

```text
Other Projects
```

项目卡片显示：

* name
* description
* my_role
* updated_at
* 进入项目按钮

点击进入：

```text
/projects/:projectId
```

页面状态要求：

* loading
* empty
* error
* token 失效自动跳转登录

---

## 八、Project Detail 页面

路径：

```text
/projects/:projectId
```

接口：

```text
GET /api/projects/{project_id}
```

页面显示：

* 项目名称
* 项目描述
* 当前用户角色 badge
* meta_info 摘要
* label_mapping 摘要
* 图片入口
* 设置入口
* operation history 不在项目级展示，第一版只在图片标注页展示

建议 Tab：

```text
Images
Settings
Members，可选
```

---

## 九、Project Settings

路径：

```text
/projects/:projectId/settings
```

接口：

```text
GET   /api/projects/{project_id}
PATCH /api/projects/{project_id}
```

可编辑字段：

* name
* description
* meta_info
* label_mapping

只有 supervisor 可以编辑。

worker 进入页面时：

* 所有字段只读
* 不显示保存按钮，或保存按钮 disabled
* 显示提示：

```text
当前角色为 worker，只能进行标注，不能修改项目信息。
```

### meta_info 编辑

使用 JSON editor 或 textarea。

保存前必须校验 JSON 合法性。

### label_mapping 编辑

`label_mapping` 用于把后端数字 label 转换成语义标签。

推荐结构：

```json
{
  "1": "chromosome",
  "2": "overlap",
  "3": "noise"
}
```

前端显示 label 时：

```ts
export function getLabelName(label: number | null, mapping: Record<string, any>) {
  if (label == null) return "未设置"
  return mapping[String(label)] ?? String(label)
}
```

Label 下拉框：

* 如果 label_mapping 非空，从 mapping 生成 options
* option value 必须是 number
* option label 显示 `1 - chromosome`
* 如果 label_mapping 为空，允许手动输入 number label

---

## 十、图片管理

图片列表路径：

```text
/projects/:projectId/images
```

接口：

```text
GET /api/projects/{project_id}/images/
```

图片卡片显示：

* thumbnail
* file_name
* width
* height

点击进入标注页：

```text
/projects/:projectId/images/:imageId/annotate
```

### 上传图片

接口：

```text
POST /api/projects/{project_id}/images/
```

Content-Type：

```text
multipart/form-data
```

字段名：

```text
file
```

示例：

```ts
const form = new FormData()
form.append("file", file)

await api.post(`/api/projects/${projectId}/images/`, form)
```

权限：

* supervisor 可以上传
* worker 不能上传

worker 不显示上传按钮，或者显示 disabled 状态。

上传成功后刷新图片列表。

---

## 十一、标注界面总体要求

路径：

```text
/projects/:projectId/images/:imageId/annotate
```

标注界面是系统核心。

必须支持：

* 加载原图
* 加载已有 annotations
* 渲染 box
* 渲染 polygon
* 渲染 keypoint
* 创建 box
* 创建 polygon
* 创建 keypoint
* 修改 annotation
* 删除 annotation
* 选择 annotation
* annotation list 点击定位
* label mapping 显示语义标签
* operation history 展示

第一版不实现：

* rollback
* undo
* redo
* 多人协同
* WebSocket
* AI 自动标注

---

## 十二、标注界面必须使用 map-based annotation

不要使用普通 canvas 作为核心标注系统。

优先使用：

```text
OpenLayers
```

原因：

* 自带 map viewport
* 自带 zoom / pan
* 支持 vector layer
* 支持 feature
* 支持 Draw interaction
* 支持 Modify interaction
* 支持 Select interaction
* 支持 Polygon
* 支持 Point
* 支持 Box
* 后续可以接 WSI tile source

备选方案：

```text
OpenSeadragon + overlay
Leaflet + CRS.Simple + leaflet-draw
```

如果使用备选方案，必须说明原因。

---

## 十三、OpenLayers 标注架构

推荐组件结构：

```text
app/components/annotation/
  AnnotationMap.tsx
  AnnotationToolbar.tsx
  AnnotationSidePanel.tsx
  AnnotationList.tsx
  OperationHistory.tsx
  LabelSelect.tsx

app/lib/annotation/
  imageProjection.ts
  imageSourceAdapter.ts
  annotationCodec.ts
  annotationStyle.ts
  mapInteractions.ts
```

职责划分：

### AnnotationMap.tsx

负责：

* 初始化 OpenLayers Map
* 加载 image layer
* 加载 vector layer
* 挂载 draw / select / modify interactions
* 响应工具栏状态
* 抛出 create / update / delete 事件

### imageProjection.ts

负责：

* 图片像素坐标和地图坐标转换
* 统一处理 Y 轴方向
* 统一处理 extent
* 禁止在业务组件里到处写坐标转换

### imageSourceAdapter.ts

负责：

* 普通图片 source
* 后续 WSI / tile source 适配
* 不允许把图片加载写死成 `<img>`

### annotationCodec.ts

负责：

* 后端 annotation 转 OpenLayers feature
* OpenLayers feature 转后端 annotation input
* box / polygon / keypoint 数据结构转换

### annotationStyle.ts

负责：

* 不同 label 的样式
* selected annotation 样式
* draft annotation 样式

### mapInteractions.ts

负责：

* draw box
* draw polygon
* draw keypoint
* select
* modify
* delete

---

## 十四、图片坐标系统

后端保存的 annotation 坐标必须是图片原始像素坐标。

不要保存屏幕坐标。

不要保存缩放后的坐标。

不要保存 canvas 坐标。

推荐统一坐标：

```text
x: 从图片左上角向右递增
y: 从图片左上角向下递增
单位: pixel
```

普通图片 extent 推荐：

```ts
const extent = [0, 0, width, height]
```

如果 OpenLayers 的显示坐标和图片像素坐标方向不一致，必须在 `imageProjection.ts` 里集中转换。

需要提供：

```ts
export interface ImagePoint {
  x: number
  y: number
}

export function imagePointToMapCoordinate(point: ImagePoint): [number, number]

export function mapCoordinateToImagePoint(coordinate: [number, number]): ImagePoint
```

所有保存到后端的数据必须先转换为 image pixel coordinate。

---

## 十五、普通图片 source

当前第一版使用普通图片。

原图接口：

```text
GET /api/projects/{project_id}/images/{image_id}/original_image
```

缩略图接口：

```text
GET /api/projects/{project_id}/images/{image_id}/thumbnail_image?w=300&h=300
```

图片详情接口：

```text
GET /api/projects/{project_id}/images/{image_id}
```

如果 `image_url` 可以直接访问，则可以直接作为 source URL。

如果图片接口需要 JWT，则需要通过 authenticated fetch 读取 blob，再生成 object URL：

```ts
const blob = await api.getBlob(`/api/projects/${projectId}/images/${imageId}/original_image`)
const url = URL.createObjectURL(blob)
```

组件卸载时必须释放：

```ts
URL.revokeObjectURL(url)
```

---

## 十六、WSI / 超大图扩展预留

第一版只实现普通图片，但架构必须为 WSI 预留。

不要把 annotation 系统和普通图片强绑定。

定义 image source adapter：

```ts
export type ImageSourceKind =
  | "static-image"
  | "zoomify"
  | "dzi"
  | "iiif"
  | "xyz"

export interface ImageSourceConfig {
  kind: ImageSourceKind
  width: number
  height: number
  url?: string
  tileUrlTemplate?: string
  tileSize?: number
  maxZoom?: number
}
```

第一版使用：

```ts
{
  kind: "static-image",
  width,
  height,
  url
}
```

后续 WSI 可以扩展：

```ts
{
  kind: "zoomify",
  width,
  height,
  tileUrlTemplate
}
```

或：

```ts
{
  kind: "dzi",
  width,
  height,
  tileUrlTemplate
}
```

如果后端以后提供 tile endpoint：

```text
/api/projects/{project_id}/images/{image_id}/tiles/{z}/{x}/{y}
```

只需要新增 adapter，不应该重写标注逻辑。

---

## 十七、annotationCodec 要求

必须写独立转换层。

文件：

```text
app/lib/annotation/annotationCodec.ts
```

必须提供：

```ts
export function annotationToFeature(annotation: Annotation2DOutput): Feature

export function featureToAnnotationInput(feature: Feature): Annotation2DCreateInput

export function boxToFeature(box: Box2DDataInput): Feature

export function featureToBox(feature: Feature): Box2DDataInput

export function polygonToFeature(points: number[][]): Feature

export function featureToPolygon(feature: Feature): Polygon2DDataInput

export function keypointToFeature(points: number[][]): Feature

export function featureToKeypoint(feature: Feature): Keypoint2DDataInput
```

OpenLayers geometry 映射：

```text
box       -> Polygon Feature
polygon   -> Polygon Feature
keypoint  -> Point Feature 或 MultiPoint Feature
```

后端保存格式：

```ts
{
  annotation_type: "box",
  label: number | null,
  box: {
    x,
    y,
    width,
    height,
    rotation
  },
  polygon: null,
  keypoint: null
}
```

```ts
{
  annotation_type: "polygon",
  label: number | null,
  box: null,
  polygon: {
    points: [[x1, y1], [x2, y2], [x3, y3]]
  },
  keypoint: null
}
```

```ts
{
  annotation_type: "keypoint",
  label: number | null,
  box: null,
  polygon: null,
  keypoint: {
    points: [[x1, y1], [x2, y2]]
  }
}
```

box 后端结构虽然是 `{ x, y, width, height, rotation }`，但地图上可以用 Polygon Feature 表达。

第一版 rotation 固定为 `0`。

---

## 十八、标注工具交互

### Select 工具

必须支持：

* 点击选择 annotation
* 高亮 selected annotation
* 右侧显示 annotation 详情
* annotation list 点击后地图定位到对应 feature
* 支持清除选择

### Box 工具

交互：

* 选择 Box 工具
* 鼠标拖拽生成 box
* 松开后完成绘制
* 弹出或使用当前 label
* 调用 create annotation 接口保存
* 保存成功后刷新 annotations 或加入本地列表
* 刷新 operation history

数据：

```json
{
  "annotation_type": "box",
  "label": 1,
  "box": {
    "x": 100,
    "y": 120,
    "width": 240,
    "height": 160,
    "rotation": 0
  },
  "polygon": null,
  "keypoint": null
}
```

### Polygon 工具

交互：

* 选择 Polygon 工具
* 单击添加点
* 点数至少为 3
* 双击或完成事件闭合
* 保存到后端
* 保存成功后刷新 operation history

数据：

```json
{
  "annotation_type": "polygon",
  "label": 2,
  "box": null,
  "polygon": {
    "points": [
      [100, 100],
      [180, 120],
      [160, 220]
    ]
  },
  "keypoint": null
}
```

### Keypoint 工具

第一版可以采用每次点击生成一个 keypoint annotation。

也可以采用多个点组成一个 keypoint annotation，但必须提供“完成”按钮。

推荐第一版简化方案：

* 单击生成一个点
* 立即保存为一个 keypoint annotation
* 每个 keypoint annotation 的 `points` 数组中只有一个点

数据：

```json
{
  "annotation_type": "keypoint",
  "label": 3,
  "box": null,
  "polygon": null,
  "keypoint": {
    "points": [
      [100, 100]
    ]
  }
}
```

如果实现多个点组成一组：

```json
{
  "annotation_type": "keypoint",
  "label": 3,
  "box": null,
  "polygon": null,
  "keypoint": {
    "points": [
      [100, 100],
      [150, 160]
    ]
  }
}
```

### Modify 工具

必须支持：

* 修改 box 顶点或尺寸
* 修改 polygon 点
* 修改 keypoint 位置
* 修改 label
* 修改完成后调用 PATCH
* PATCH 成功后刷新 annotation
* PATCH 成功后刷新 operation history

接口：

```text
PATCH /api/projects/{project_id}/images/{image_id}/annotations/{annotation_id}
```

### Delete

必须支持：

* 选择 annotation
* 点击删除
* 二次确认
* 调用 DELETE
* 删除成功后从本地移除
* 刷新 operation history

接口：

```text
DELETE /api/projects/{project_id}/images/{image_id}/annotations/{annotation_id}
```

---

## 十九、Annotation API

### 获取标注

```text
GET /api/projects/{project_id}/images/{image_id}/annotations/
```

### 创建标注

```text
POST /api/projects/{project_id}/images/{image_id}/annotations/
```

### 查看单个标注

```text
GET /api/projects/{project_id}/images/{image_id}/annotations/{annotation_id}
```

### 修改标注

```text
PATCH /api/projects/{project_id}/images/{image_id}/annotations/{annotation_id}
```

### 删除标注

```text
DELETE /api/projects/{project_id}/images/{image_id}/annotations/{annotation_id}
```

创建、修改、删除 annotation 后都必须刷新 operation history。

---

## 二十、Operation History

接口：

```text
GET /api/projects/{project_id}/images/{image_id}/operations/
```

第一版只展示 history，不实现回退。

右侧面板显示：

* action
* performed_by_id
* from_annotation_id
* to_annotation_id
* created_at

展示示例：

```text
[2026-06-25 10:22:31] user#12 create annotation: null -> 45
[2026-06-25 10:25:10] user#12 update annotation: 45 -> 46
[2026-06-25 10:28:03] user#12 delete annotation: 46 -> null
```

禁止实现：

* rollback
* undo
* redo
* revert
* restore

可以预留 disabled 按钮，但不能调用不存在的接口。

---

## 二十一、权限控制

权限以 `project.my_role` 为基础。

必须做 lowercase 归一化：

```ts
const role = project.my_role?.toLowerCase()
```

### supervisor

允许：

* 查看项目
* 查看图片
* 上传图片
* 标注
* 创建 annotation
* 修改 annotation
* 删除 annotation
* 查看 operation history
* 编辑 project name
* 编辑 description
* 编辑 meta_info
* 编辑 label_mapping
* 查看成员

### worker

允许：

* 查看项目
* 查看图片
* 标注
* 创建 annotation
* 修改 annotation
* 删除 annotation
* 查看 operation history

禁止：

* 上传图片
* 修改 project name
* 修改 description
* 修改 meta_info
* 修改 label_mapping
* 修改成员
* 删除项目

注意：

不能只隐藏按钮。调用敏感接口前也必须检查 role。

---

## 二十二、成员管理，可选

第一版不是核心。

如果实现，使用：

```text
GET    /api/projects/{project_id}/members
POST   /api/projects/{project_id}/members
PATCH  /api/projects/{project_id}/members/{user_id}
DELETE /api/projects/{project_id}/members/{user_id}
```

添加成员请求体：

```json
{
  "user_id": 123,
  "role": "worker"
}
```

修改成员角色请求体：

```json
{
  "role": "supervisor"
}
```

如果没有用户搜索接口，第一版只做输入 `user_id` 添加成员。

---

## 二十三、页面状态和错误处理

所有页面必须处理：

* loading
* empty
* error
* unauthorized
* forbidden
* not found

必须处理：

* 未登录访问跳转 `/login`
* access token 过期自动 refresh
* refresh 失败退出登录
* 403 权限不足显示友好提示
* JSON 解析失败显示明确错误
* 图片上传失败显示错误
* annotation 保存失败保留本地草稿
* 图片加载失败显示错误
* operation history 加载失败不影响标注主流程

---

## 二十四、推荐目录结构

```text
app/
  root.tsx
  routes.ts

  routes/
    _index.tsx

    _auth.tsx
    _auth.login.tsx
    _auth.register.tsx

    _app.tsx
    _app.projects._index.tsx
    _app.projects.$projectId.tsx
    _app.projects.$projectId.settings.tsx
    _app.projects.$projectId.images._index.tsx
    _app.projects.$projectId.images.$imageId.annotate.tsx

  api/
    client.ts
    auth.ts
    users.ts
    projects.ts
    images.ts
    annotations.ts
    operations.ts

  stores/
    authStore.ts
    projectStore.ts

  types/
    api.ts
    auth.ts
    user.ts
    project.ts
    image.ts
    annotation.ts
    operation.ts

  components/
    layout/
      AppLayout.tsx
      AuthLayout.tsx
      TopNav.tsx

    project/
      ProjectCard.tsx
      ProjectRoleBadge.tsx
      ProjectSettingsForm.tsx
      LabelMappingEditor.tsx
      MetaInfoEditor.tsx

    image/
      ImageGrid.tsx
      ImageCard.tsx
      ImageUploadButton.tsx

    annotation/
      AnnotationMap.tsx
      AnnotationToolbar.tsx
      AnnotationSidePanel.tsx
      AnnotationList.tsx
      LabelSelect.tsx
      OperationHistory.tsx

  lib/
    auth/
      tokenStorage.ts

    annotation/
      annotationCodec.ts
      annotationStyle.ts
      imageProjection.ts
      imageSourceAdapter.ts
      mapInteractions.ts

    utils/
      date.ts
      json.ts
      errors.ts
```

---

## 二十五、实现顺序

必须按以下顺序实现：

1. 分析 `Code/anno/` 真实后端代码
2. 对照 `openapi.json`
3. 整理 TypeScript 类型
4. 搭建 file-based routes
5. 实现 API client
6. 实现 auth store
7. 实现登录页
8. 实现 `/projects`
9. 实现 project 分组
10. 实现 project detail
11. 实现 project settings
12. 实现图片列表
13. 实现 supervisor 图片上传
14. 实现 OpenLayers AnnotationMap
15. 实现 static image source adapter
16. 实现 imageProjection 坐标转换
17. 实现 annotationCodec
18. 实现 annotation list
19. 实现 box draw
20. 实现 polygon draw
21. 实现 keypoint draw
22. 实现 select / modify / delete
23. 实现 operation history
24. 补充错误处理
25. 补充最终说明

---

## 二十六、第一版明确不做

不要实现：

* operation rollback
* undo / redo 后端同步
* WebSocket
* 多人实时协同
* AI 自动标注
* Project API Key 管理 UI
* `/api/infers/project/*` 推理接口 UI
* 完整 WSI 后端适配
* 复杂标注任务分配系统
* 审核流
* 数据集导出

可以预留扩展点，但不要实现复杂逻辑。

---

## 二十七、验收标准

完成后必须满足：

1. 用户可以登录
2. 登录成功后进入 `/projects`
3. access token 自动附加到请求
4. token 过期可以自动 refresh
5. refresh 失败会退出登录
6. `/projects` 能展示项目
7. 项目能按 supervisor / worker 分组
8. 可以进入 project detail
9. supervisor 可以编辑 project settings
10. worker 只能查看 project settings
11. supervisor 可以上传图片
12. worker 不能上传图片
13. 可以查看图片列表
14. 可以进入图片标注页
15. 标注页使用 OpenLayers 或其他 map-based viewer
16. 标注页可以加载原图
17. 标注页可以加载已有 annotations
18. 可以创建 box annotation
19. 可以创建 polygon annotation
20. 可以创建 keypoint annotation
21. 可以修改 annotation
22. 可以删除 annotation
23. annotation 坐标保存为图片原始像素坐标
24. label 保存为 number
25. label 显示时通过 label_mapping 转语义标签
26. 创建 annotation 后刷新 operation history
27. 修改 annotation 后刷新 operation history
28. 删除 annotation 后刷新 operation history
29. operation history 只展示，不实现 rollback
30. 页面刷新后登录态仍然可用
31. 所有核心类型已经对照真实代码和 OpenAPI
32. 最终说明中列出分析过的真实代码文件

---

## 二十八、最终输出要求

Agent 完成任务后必须输出：

```text
1. 实际分析了哪些 Code/anno 文件
2. 后端真实 schema 和 openapi.json 是否一致
3. 前端采用的技术栈
4. 路由结构
5. API client 设计
6. 标注 viewer 方案
7. annotation 坐标系定义
8. 普通图片加载方式
9. WSI 后续扩展方式
10. 已实现功能
11. 未实现功能
12. 如何运行前端
13. 如何配置 API base URL
14. 已知问题
```

如果某个功能因为后端接口缺失无法完成，必须明确说明，不要伪造实现。


### 八荣八耻
以瞎猜接口为耻,以认真查询为荣.
以模糊执行为耻,以寻求确认为荣.
以臆想业务为耻,以人类确认为荣.
以创造接口为耻,以复用现有为荣.
以跳过验证为耻,以主动测试为荣.
以破坏架构为耻,以遵循规范为荣.
以假装理解为耻,以诚实无知为荣.
以盲目修改为耻,以谨慎重构为荣.
