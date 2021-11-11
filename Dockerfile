FROM node:14
WORKDIR /OptiGas
COPY package.json /OptiGas
RUN npm install -g npm
RUN npm cache verify
RUN npm update
RUN npm install node-fetch
COPY . /OptiGas
CMD ["npm", "start"]