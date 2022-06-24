FROM node:16-buster as base

# Create app directory
WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y chromium

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

#RUN npm install && npm install -g chromedriver

# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY . .

EXPOSE 8080

FROM base as production
ENV NODE_ENV=production
RUN npm ci
#COPY . /
CMD ["node", "index.js"]

FROM base as dev
ENV NODE_ENV=development
RUN npm install -g nodemon && npm install
#COPY . /
CMD ["nodemon", "bin/www"]