FROM node:20-alpine

WORKDIR /app

# Copy application code
COPY . .

# Ensure data directory exists
RUN mkdir -p /app/data/uploads

EXPOSE 3000

ENV PORT=3000

CMD ["node", "server.js"]
