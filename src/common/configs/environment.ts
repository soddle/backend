import * as dotenv from 'dotenv';
dotenv.config();

export interface IEnvironment {
  APP: {
    NAME: string;
    PORT: number;
    ENV: string;
  };
  DB: {
    URL: string;
  };
  JWT: {
    SECRET: string;
  };
  GOOGLE: {
    CLOUD: {
      API_KEY: string;
    };
    GEMINI: {
      API_KEY: string;
    };
  };
  APITOOLKIT: {
    API_KEY: string;
  };
  MORALIS: {
    API_KEY: string;
  };
}

export const ENVIRONMENT: IEnvironment = {
  APP: {
    NAME: process.env.APP_NAME,
    PORT: Number(process.env.PORT),
    ENV: process.env.APP_ENV,
  },
  DB: {
    URL: process.env.DB_URL,
  },
  JWT: {
    SECRET: process.env.JWT_SECRET,
  },
  GOOGLE: {
    CLOUD: {
      API_KEY: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    },
    GEMINI: {
      API_KEY: process.env.GEMINI_API_KEY,
    },
  },
  APITOOLKIT: {
    API_KEY: process.env.APITOOLKIT_API_KEY,
  },
  MORALIS: {
    API_KEY: process.env.MORALIS_API_KEY,
  }
};
