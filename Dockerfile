FROM node:20-slim
WORKDIR /usr/src/app

# Install dependencies (including dev deps needed for TypeScript build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build -> produces /usr/src/app/lib/index.js
COPY . .
RUN npm run build

# Runtime
ENV NODE_ENV="production"
CMD ["node", "lib/server.js"]
