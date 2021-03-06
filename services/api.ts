import axios, { AxiosError, AxiosResponse } from "axios";
import { parseCookies, setCookie } from "nookies";

let cookies = parseCookies();
let isRefreshing = false;
let failedRequestQueue = [];

export const api = axios.create({
    baseURL: "http://localhost:3333",
    headers: {
        Authorization: `Bearer ${cookies['nextAuth.token']}`
    }
});

api.interceptors.response.use((response) => {
    return response;
}, (error:AxiosError) => {
    if (error.response.status === 401) {
        if (error.response.data?.code === 'token.expired') {
            //renovar token
            cookies = parseCookies();

            const { 'nextAuth.refreshToken' : refreshToken} = cookies;
            const originalConfig = error.config            

            if(!isRefreshing) {
                isRefreshing = true;

                api.post('/refresh', {
                    refreshToken,
                }).then(response => {
                    const {token} = response.data;
    
                    setCookie(undefined, 'nextAuth.token', token, {
                        maxAge: 60 * 60 * 24 * 30, // 30 days
                        path: '/',
                    })
                    setCookie(undefined, 'nextAuth.refreshToken', response.data.refreshToken, {
                        maxAge: 60 * 60 * 24 * 30, // 30 days
                        path: '/',
                    })
    
                    api.defaults.headers['Authorization'] = `Bearer ${token}`;

                    failedRequestQueue.forEach(request => request.onSuccess(token))
                    failedRequestQueue = [];
                }).catch(err => {
                    failedRequestQueue.forEach(request => request.onFailure(err))
                    failedRequestQueue = [];
                }).finally(() => {
                    isRefreshing = false;
                })
            }

            return new Promise((resolve, reject) => {
                failedRequestQueue.push({
                    onSuccess: (token: string) => {
                        originalConfig.headers['Authorization'] = `Bearer ${token}`;

                        resolve(api(originalConfig))
                    },
                    onFailure: (err: AxiosError) => {
                        reject(err)
                    }
                })
            });
        } else {
            //deslogar user
        }
    }
})