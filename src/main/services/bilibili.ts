import BilibiliVideo from '../../types/modal/BilibiliVideo';
import { getGotInstance, cookieJar } from '../network';
import IService from './IService';
import crypto from 'crypto';
import GeetestCaptcha from '../../types/modal/GeetestCaptcha';
import configService from './config-service';

async function getCSRF() {
  const config = await configService.fns.getAll();
  return `; ${config.cookieString}`
    .split('; bili_jct=')
    .pop()!
    .split('; ')
    .shift();
}

const fns = {
  async getVideoInfo(bvid: string): Promise<any> {
    const got = await getGotInstance();
    return (await got
      .get('https://api.bilibili.com/x/web-interface/view', {
        searchParams: {
          bvid,
        },
      })
      .json()) as any;
  },

  async getVideoPlayUrl(bvid: string, cid: string): Promise<any> {
    const got = await getGotInstance();
    return got
      .get('https://api.bilibili.com/x/player/playurl', {
        searchParams: {
          cid,
          bvid,
          fourk: 1,
          otype: 'json',
          fnver: 0,
          fnval: 976,
        },
      })
      .json();
  },

  async getSelfInfo(): Promise<any> {
    const got = await getGotInstance();
    return got('https://api.bilibili.com/x/space/myinfo').json();
  },

  async getCaptchaSettings(): Promise<any> {
    const got = await getGotInstance();
    return got('https://passport.bilibili.com/x/passport-login/captcha').json();
  },

  /**
   * 使用密码登录，不报错视为登录成功，会自动更新配置。
   * @param username
   * @param password
   * @param captcha
   */
  async loginWithPassword(
    username: string,
    password: string,
    captcha: GeetestCaptcha
  ): Promise<void> {
    const got = await getGotInstance();

    // 获取加密配置
    const encryptionSettings: any = await got(
      'https://passport.bilibili.com/x/passport-login/web/key'
    ).json();

    if (encryptionSettings.code !== 0)
      throw new Error(`获取加密配置错误：${encryptionSettings.message}`);

    // 加密密码
    const encryptedPassword = crypto
      .publicEncrypt(
        {
          key: crypto.createPublicKey(encryptionSettings.data.key),
          padding: crypto.constants.RSA_PKCS1_PADDING,
        },
        Buffer.from(`${encryptionSettings.data.hash}${password}`, 'utf-8')
      )
      .toString('base64');

    const loginResult: any = await got
      .post('https://passport.bilibili.com/x/passport-login/web/login', {
        form: {
          source: 'main_web',
          username,
          password: encryptedPassword,
          keep: true,
          token: captcha.token,
          go_url: 'https://www.bilibili.com/',
          challenge: captcha.challenge,
          validate: captcha.validate,
          seccode: captcha.seccode,
        },
      })
      .json();

    if (loginResult.code !== 0)
      throw new Error(`登录失败：${loginResult.message}`);

    // 更新配置
    configService.fns.set(
      'cookieString',
      await cookieJar.getCookieString('https://www.bilibili.com/')
    );
  },

  async getLoginQrCode() {
    const got = await getGotInstance();
    return got('https://passport.bilibili.com/qrcode/getLoginUrl').json();
  },

  async getLoginQrCodeStatus(oauthKey: string) {
    const got = await getGotInstance();
    const resp: any = await got
      .post('https://passport.bilibili.com/qrcode/getLoginInfo', {
        form: {
          oauthKey,
        },
      })
      .json();

    if (resp.status) {
      // 登录成功，更新配置
      configService.fns.set(
        'cookieString',
        await cookieJar.getCookieString('https://www.bilibili.com/')
      );
    }

    return resp;
  },

  async logOut() {
    const got = await getGotInstance();
    try {
      await got.post('https://passport.bilibili.com/login/exit/v2', {
        form: {
          biliCSRF: await getCSRF(),
          gourl: 'https://www.bilibili.com/',
        },
      });
    } catch (err) {
      // 不处理 cookie 清空错误。
    }
    await cookieJar.removeAllCookies();
    configService.fns.set('cookieString', '');
  },
};

const bilibiliService: IService<typeof fns> = {
  name: 'bilibili',
  fns,
};

export default bilibiliService;
