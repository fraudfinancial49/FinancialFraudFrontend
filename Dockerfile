# --- Stage 1: build the static Vite bundle -----------------------------
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .

# Vite inlines env vars at build time, so the deployed backend URL must be
# passed in as a build ARG (defaults to the Render deployment below).
ARG VITE_API_BASE_URL=https://financialfraudbackend.onrender.com
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# --- Stage 2: serve with nginx ------------------------------------------
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
