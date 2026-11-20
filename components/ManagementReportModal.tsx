import React, { useRef, useState, useMemo } from 'react';
import type { User, SalesPerson, Quotation } from '../types';
import { generateFormattedQuotationNumber } from '../utils/quotationNumber';
import { calculateTotalAmount } from '../utils/calc';

interface SalesPersonStatRow {
    id: number;
    name: string;
    total: { count: number; value: number };
    [status: string]: any;
}

interface ManagementReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    salesPersonStats: SalesPersonStatRow[];
    performanceTotals: {
        total: { count: number; value: number };
        [status: string]: any;
    };
    dateRangeLabel: string;
    currentUser: User;
    quotations?: Quotation[] | null;
    customerMap?: Map<number, string>;
    salesPersons?: SalesPerson[] | null;
}

const formatCurrency = (val: number) => {
    return '₹' + (Number(val) || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const formatCurrencyCompact = (val: number) => {
    const v = Number(val) || 0;
    if (v === 0) return '₹0';
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)}Cr`;
    if (v >= 100000) return `₹${(v / 100000).toFixed(2)}L`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(1)}k`;
    return `₹${Math.round(v).toLocaleString('en-IN')}`;
};

// Official Siddhi Kabel Logo from email signature
const SIDDHI_LOGO_BASE64 = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAH0AAACACAYAAAAmjGbiAAAbZklEQVR4nO1dCZgU1bX+a+llunv2hRlmZ2DYRCQDiorghlsEE15MXsx7+jTGYDQ+E75EeX4hT5MXIdFoosQXE6OCXxITRJ9oQMGAIgKyDsIAM8MyzEzPvvW+VdX7zq3unu6ZnlVhpmfq/76Cnqq61dX133PuueecewqKhlGNt99+WwHAtoKCAsVqtUbtW7RokWK324d0Ta6q8qxSefIsZJmuoWEgcDyHgvwczJpdiguFu+66C+vWrcPbb7+NJUuWwOFw4NZbb0VhYSFeffXVIV9PrDh2Ch2dHTBbEsBx3Hm56bEESZJx8GDFBSW9J9auXTtswgki/Yj8wmxkZKZA43xgeL1+HD18BiOFNWvWYPPmzXjnnXei9j366KMoKCjAnj172GfSDIsWLWLnUScJHV+5ciVEhAYHhf7VJH0gsMc0Qli6dCn732Qy4eTJkygrK2N/P/DAA6wjnDmjdsbVq1djx44d4XaPPPIIKioqWEfYvXs3+Ji/SpYjft347QiKojBbRxWIkQeN6XfeeSdcLhdWrFjBxvahgDrLQw89FIN0WYJ0uhJSXS0UpwOK2wXF51M7AmEMjwGKosDvD8Dr9cHj8aKtrQu155oQCEgYLSBVTWr7ww8/ZJ+HA6beoyCIEIomQ25sgOflVyCfPQdh5nSIcy6BUFICzpigagFBAHg+rjuBLMtsI20W8AfQ1NSO6spanDldj0SLCQsWzUFuXiZEUcBogcViwdNPP42FCxfiiSeewPXXX4+pU6dGnWO1WtHa2ori4uKY1+A2btiqJKUlICMjOdp6p8/0UKxWeP/vbfi2bQen04FPT4VQOgVi2RyI06eDS01Tzw91hFHaCUiK1Q3sFl1OD+pqm1B1sha15xrQ1emEz+fD1OnFWHRNGSbkpEEQhF6qnQy5Y+Vn8B/3fPWC3PemTZvCY3nIUNu/f3/U+P7RRx9h27ZtzFgjzJ49m/1fXl7OhgRC6HwaHvomPYTgPrmlGb7NW+B7ZwsUhxOKLIM36MFlZkCYXAJx9iyIM2eCz8kBRFHtBCPcAYgw+k0kzZ0dDtScbcDp6jrU1zWjs8MGn88PnuMg6kRcUjYNly+YjczgLKavYfxCk34+0Fu990Tw1/MZmTDedRcMX7kNvvfeh/etTVDaO6E0NEG2NsK3/SNwggA+Iw1CSTF0Vy+EbsFV6hAwQiBVfWBfBaz1LejqtLOxmed51hGoQxgTDJh36UzMv/JipKYlBVX9yFroo4P0SMgyuMQkGG6/HYYlS+Dbto2RLzc2h7WE3NYBxe2B/pabAYFX54MjALodk9nIDDG7zcn2kbomJCaaMHf+TMy/fBZM5oSglR40VMcBhieGJAoGA/S33ALz4z9hY30YHGC4fRnEOXNGjPDQLU7MzcTim+aDp84XBM/z+Jd/XYxrrpuHBJNx1EzHLiQ+n+4VBHjWvwZFCk5pFAXinNnQ33yjatSNMEj7zJhVgjll08L7FEXB+//YPa5jDcMnneMQ2P0J/Ls+JYc0I5xLTkTC95aDM1kwWqATBVy3+FKkpSeFLfgGawv27DoybmMNw1bv5LRxv/insNXDiSJMP/oB+MxMdSwfBQ+USCV1TsGkb/77zdDr1WGIiN/+wT60t3WNS/U+NEMuBI6DZ91rkJtawrsURYbnldfA5++AUFwIoagI/MSJ4FKSwekNvefwX+DDDkksM8gUhTlanA4P2tu70NTQhqbGNjQ3tUcZa16PD//Y9DHuuPNmjDcMnXRZRqDyJHzvbeuxX4F06gyk02fh37UbnF4PzmgEZzGDS00Bn5UFPj8XfH4ehOxscCmp7DjI28Xxg+4EoTm0LMnw+f1wOtzoaLejpbkDrS0d6Gi3wW53weP2wuvzsw5AkcRYEl15ogZHyqsx6+LJ4PmR10yjWtJ9G98CR4EIelBkEIUeaIgRfwAKbU4X0NoGnD0H0Lm8oHYGswlcchL49DRw2RMg5OZAt3Ahmw72B78vgCOHKxnBHR12dHU64HS64PH4mM+cHEb09SGnTE+EiOc4jt0qWfWffvIZZswsBs8PT+nFI4b+S8mp8W/fgnz9dZCsVsjWBshNzVDa2qF02aC43FD8/uhIHesMLAMBitvNzkFLK6Tq0+wwnzMBumuuGVTWyv5PK5j7VI3+KeDo/xhCGiKe2oiCwMZzmrcnJpqRkpqItIxkpKcnM6fMaDfoDhw4wHztFF0LgcKnFDIdKNsmFFMnn/3wSSevW2Eh21hjIlcKQHG5ILe3Q663Qq6thVRnhdzconYEpxPweILROnLPUsPuB2247VZ13B8A5DK95vp5+PO6zeFASRgcWeoi9HoRBqOBEZycbEF6Rgoys1KRkZmK5GQzjEYDBJFnBl4Io9mYCxH+ta99LZwpQ4QOhJ4x9UgMT6dFPiSSElEHLikZQnIKhOJJwXNkIKBKttzaAunESbhf+EOv6/AFedDfdKPqrx8ApI4nl+ajsCgHp0/VR08QFGDhtWUomZyH1NQkGIx6CAKRy4W1QuRtK6OY6J4Rs0gJJww3TSqEL9Yxrg6owU5BnUEEl5gIPmcipMqqmMaa8Y6vs7F+sCB1vvjm+YzQnqg6eY6lfdEUjcKhqo89FGFDXGLu3LksukaqmvLiGhoaoo5TqpRqo6gb/d2f1jCbzV8w6bEgSQgcOgTf9p293LJ8YR50l16mOndCdkAfIOLICpdkGdk5GSguiet1Tm1NIw58epydN1aQk5ODjRs3shDquXPnMHHixLB6JxIpkYJCraQRqHNQ2lSsjJrQMDFv3rxhqvfBgubNVis8pNaJ1B4Gk1LfCPvyB9i8Xrx4FoSLZ4GfmMt8+UxC6SSeYyR2dthx5rQVp6tq0dDQClswiBL9dQp2fLAfefkTUFCUPeoNtMGCcuGcTmc4tk5SP2PGDGbIUUcghDQA5cnZ7fY+hwnKuDmvpJPXzrNuPeS29pgeOvLZKy1tkJtb4d+9j3nyaCon5OVCmTkd5VmTUFnbjpbmdjYfV0OjqhrrC5TmtPndXczpkpRkxljCkiVLmIEWSpaItNJDIGnvD5REcR7VuwLfe1vh37N/YJcsHWcBGg5Klx2Bo8fRtfFd7H/vE5w+VQeH3cWkmMbxgaSXjltrm/Hxh4fGRLh0zZo1UdY6ZbUSSNJp/4YNG5h6p42GgJ4IST4NC3ScLPrzRrrS3g7p2DFwpgR1zKbkwsEaU2SUEMFDTMAgkmko0BlEljjR0tyJsYB169aFDTX6TNJOUk/TOFLZZOxRduzixYuZug/lvdNn2ugzDRF//etf2d8Dp0t9HpD17HRCrjmLQPkRBI4eg3S2FkpnF5RAgGXa9KUFnAYjNhSVoUVnipmEzSxyWWHOF0qEoDSngqIcNmXLyc2EyWTE+YB3XKRLfR6QV8xkgjB1GoQppSzjhsiWGxogHSlH4GA5pDM1kLu6AJ9fbdOHdIemXaTiyfGSlZXGLPjJU/KQmZ3GHDMhL9x48qMPBxfG4UxEBskk6RYKCyHk5kF3kxrhUjraETh6FIG9+xGoqgY6uoIN1XHclGDEhJx0TJ1exCSZ3KghrRQ9zmtkDwYjE2UgknRi0BvLgcuaAP2iDOiuXKD6551O6M7W4CbRjPSCXJjNRuaNUz1s5HQZkbseMxj50FIoVZq8d+SKpU5gNsOYmYkpdEhT1WOQ9J6ICH9q2vr8YOSS0jWMGDTSxyE00schRBZpPnkCgTq9moWioV9I5BCSExDPEMle8j//ApwOG3m+R/p+Rj0kgxHcw/81KtKlqAIFFRwi/zqtZqUw7GBSplT1rkQ6N3psHPnABXCCyP5nmauxziM9ETovYlMTJLj+N1pUOJx2XO924XuMvO/w1v/9d99PrN8Rajdy6VKhxRoUKRsMqGPEirqJ/QY8KKFwQiYMOdngE4yQnG74GhrhbW5huW5sOVNESop55jSISYkRD0eBr7kFrio1ATImFAWGnBwYC/KjAiz+zk64TlR1L5mKAcGcAMusi6LaUVKm42gFy4y1zJwOntKsQ8ckCc7jJxHosvV9PxwHy/RSiCkp3e1kGd6GRnjO1GC0pUv1lQfXH3qTznHQpSQh9zt3I/3GG2DMLwCv14cPyz4vPLV16Ni+A7UvvIgALVcOpkiV/PQxJH2prNt/rshoevMtVP6wO/7bE0RExi03oGjFiiiCOnbuxPHlD0GipMpY4DgYiwpw0SsvgTd0J1X629pw5BvfguzxYuozT8EY0dMlhwMV992Pzl17+gz0UAcqXvljpCxY0P2bvV40rF+PU48/iZFMlyKCI9V4z6pStD/WUBBZkYKOR1vvCmDMm4iZr/wR+fffD1PJ5CjCCbzeAFNJCXLv/TbmvPsWk+6QpCm0qCDycvTHYGLasUwJ1ngAGyNW4lu4liJF4Xp/t0IJmxjGZQfR7kKnS9GYTuN1CJQ9s2zZMmRkZDAN0TPGHjoeTTrPoeTxn8By0UWDWotmyM7B5F/8jA0FLBWSkhEjjjOv2ihYvTpUcLEKcgwhefN8pUuFSomQ1MdKgCSSqWNcffXVrLNQB6EO0PN4lHrXZ2XAXFqqGjwRkNxuuKqqkFBcBLHHKhTztGnQT8iCp74B1StXQTCbI56aAj+lSqldQt0TsgNIO9CKlMFWbqJzSXKpXTjrFkOHAhbeZStuyKijazIbRv3N9B2nHv8fiImJ3U1kGf6W1iEndVyIdKnhoJt0RUECLTyM+LFstySha9cuHH/whyh48D7kP/hg1HFS/8bCfHitjUj/8g1IoPEjRLqiwLbvANzra4O2QjImfH0ZUhcugGCxwN/ZBduevRDTUvotUyKYTUi7diEylnwZhglZkN0eOI6fgPPEiSERQZrINHUy0hdfC/PM6RBMJkZm6+b30fruFkhuD9NO6TdeB9PU7jKgSsCPzp27mC1zoUESTSlSIeMtMl2qJyJTokiV96wyFToeRbo+I7OXlDOLt6qSWcXuc7Uxb0xMTWWkJs+7FEllZd1jvCIzggi6jHRcsvF16DMz1coV1C9kBSmXXcYI5yOrWUReOzkJU9b8HKlXXaUabCShCpD4pTI1+2YQiyQi7ZFJK1cGp4jBrB1ZRvLlVyD7m9/A0bvuhex2I3nuPKRceUWU8epvahmxBRKkziOTH0PpUtQhKLuVQNJPHWPVqlXsMxFMVaamTJkSrjlH2bN0POqJqVZw9IBGBIqJyaFFIn0+zJCKJELD0kc1amifKCLrK1+GgZYuR3YqOo0I6EtaFRo+SpFyxRXqsBF5XywmT51nCHNn6lxGI1PX4e/keQiiyKZ+5hlTYT94hNkhkSVVOBoCYiyuuBAgovpasxbrWH/nh45HkR5w2HtZqURS0ty5TB3bDhxC9U9W9bqQ/XB5v/NperC61NReWsRTew6nVj2B3HvvRvJll8WUWt6UEDUlI8g+H06t+m8YCwuQ9517By3t1K5pwwZ07fkUU578OQSzJarjMh/DOMjQ6H5aHA/P2RooXi+VX+o+g+OYATfjDy/gzJNr0Pj6G8z4iqovELlcORaCi1ajoChwVVWjbes/YZpSwjrWoMnzetD67mYYJxUh9567B92OhqjWf2xB5yd7UbjiP5EQQfp4QrfO4gB3TZ3qbetBIEla0pxLMOP3a1H48IPQZ6Yz4tm8nJYQhdevDQ2qJa9ax0NqT3NwSqsiK3xIXxj0IjJv4hC/cwwhaqAiz1PTG28gEGMtFEkTGWHklJm+9lmkLJg/4lMYDcNDNGuygsa//B3Nb76FgM0WQxI4NkVLKpuLac//hk2/VEt87I+DY5d0msE4XTjzi1+i5tnfwGu1qlUleoLm3KlpKHl8FbK/eTvzyGmIH/Rmiwrour1oePXPOHvPfbAfKYdEzvsY4x9vMKLohw8zT95I1oDV8LkkPTTXVlOR3dWnceye5ah97nmm7mMFMCgEOeF2UvNkQY9PwyjeEDXXES1mJF1WBl4XEVlTFHTtP4DOO+/GjD/+nhlzPZF86TzU/e9LF+SGNXx+RLhhAUNBLkp/uRq6tPTu3bKM9q3bUHH/91G54keY+cqfelntYkpqsLTYF3BHGi609R5r7qrGpWle6/jsGCRH7yoHPT1mGuLIOSN7/arTIgrdETNyY8peX++rsCmbJuZxOaZLNjsjtmdgQzAlqCmDOj14Y2+pZq5bLX36vMJjc6CzsQNiMF8hXIaFAySv+qYKFRwEnoMiAEazHuak3nxFB1xsNkg9i9RwHMzTpiJr2VKkLFoA0RIdbw8lMTJp789HEysbRRSYW7S/4gSxr6We2zOAM5bRVFUDXhQhcXoWXmYvymLFtikLufv5UlFEXk9FFA2Q5dhBsCjSZZ8fjooKJJSUROXG6TIyMWX1L/p8JVf7hx/2H2smIy9UdCAEir/Pn49pv/s10hYtin47RBiKWrqkx1RRMJkx7flnWYw+druxB14EfB4D9Hq1+obMAa/t7cA/T/vgkTnML0rA8kXJSLboIAgi/F46r49r9dxxdvVTLDUqMlTKXshjNPZKkiTYyw+jcf3rQc9dbGmlwEjb+x8g0EOLCAkmZC1ZymYLMf34HAfXqTPwtbZG7xYEpC5cCMtFs8aV/58XgYBHgavNi+e2NODjGh+uyDfiqnwDGjr8WPlWOzhJgMeuQO4nFtXrifnbO3B8+YNoeWcTAp2dUGKoCLLm6Vjj66+j4rvfh+TxBCNtlCnjYh482igLRY2gyXBVn0b1ysfgPnuWhUYjiwV7GxpgP3xQHV6CbVkETVHz5iuWPwD7oYOQnA61/GgwuYOGoq69e6LaSV4Pu2fKC6BrhPfTRvcpU3sFit/Hcv8ij4dmL+yYK/p3DCqr9wKA6tomJBvwgTWAsglG6AUOc/KMmJdrgNUm4+BZz4DL03oFosl699RZUf3Y4zBNeQ1JX5oDU+nk4Nxdgb+1Dc6TlbAdPMQ8dhJVdCZwHE498WSPxQ6Av4VeBMAxq79181bYDh+BeWopy6sjzeFrbFKngm43jHl5YXcudSrZ72clxGnRw7Fv38/uwzS5BEKihS1YcFYch6e2HqaSSeF2VHTYx1KbZFSu+DH4hIgyW1IAzqpTbDCseuQnUXn2BFdlJSP97C9/HbXYgQj3NTWNGq3SavMxYZpgFvBZqxcujwKPrGCCCeh0959o+umpNpV0WsMWWtQTnp7ZHXAcLIfj8GfqmxeZmxVhIpgBFixzFYLr2PFeEzd23dA5gQC8tfVsCz/AYCye2nnrG2K3DQQQaGuHbfensO3ZF1HpX81ktbW2RX1v6I7shz/r9aO54GY/VB7zGPsdx0/28TtGxxwlI0mPTCOH6mYvjDyHk80eFKUbcKZLwvTs3kNwJKbnJoEVfmkzJ8NB67cGk1RA43r/1x3TUPR6KCMYSpYDHuiMSbh7sh5rT7hweY4FNhnYXufFg/OSkarjYUgQ+3wpcKJRB7F4Uj4O33sfnKPozcGjGZwgoHTmlAv/vZTLICsQdOlQ/MAVlxRjcoEDH1e3IS2bx1UzspGfrIfkBrrcXvA6HpaM3lPaN/fVknCP05yhOIP1SB1cbb19JP3BPEFAzozoPECN9HGK0WGOarhgEL71Z029j0dokj4OoZE+DqGRPg6hkT4OoZEeR2g9Wod9q9/93NfRSI8jHP/BGrRuq8bJR97/XNfRSI8jTOw8g1T7MbQdqEf1ii3Dvo5GehxBcHHIcTZC6DyAlqPNOD5M4jXS4wicyQD4ZeQ5rRBb9qNxjxVtFfVDugbVohl9Rf419Ak+JxM6iwLO6UGuowXuW/VIn5GLoYDKimmkxxH0l5RC2n4MCVk5MD52GybeNn9Y19HUexwh5fZb4ff4oCgSHK/+E4onxjLyAUBVpzTS4wiGWVPAz86Hq6MLos+N9rt+B8XVvThl630v4tBT2xGw0+KTvqtPaqTHGXJ/9Sj86YC7ww7e1YnmO55F4FQjOp/ZAuV0E+o31eDYo1v7vYaWOROH8Nc0onb5T2HssiAhNRXeLhn+QBqSfMmo4ZxwFaXBlGfBxb+5JWZ7TdLjELrCbOT99qeQSpLhaOkCrXTi9Bx8ghuFfh5JNe1w1LpQ/vOdMdtrkh7nsP1tD1rWbwbXZoIsG6GTBCRIPFp1ATSUZuC69Xf0aqORPkbg2HYStvfKEWj3Qwnw0GVYMPHpJTHP1Ugfh9DG9HEIjfRxCI30cQiN9HEIjfRxCC3KFqdw/WUHpOc2QQi9b17UQ5xTAt1vvzNgW03S4xD+2ia0PPNmmHD98qUw/vq74LoCkF8d+I2MGulxiPq1f4cUUQ6FP3AG3I4KcBwP/98+GbC9pt7jEF1NjdArCrz0nlqBh3y6AVx9GxSvH1JX14DtNUmPQ+jy09FhcMMmSZBlBQF7F3ydHfB3toPv8VarWDlyGulxiEn3fgNtJieaeQ9aAgHYPV54nC54AwHwty/sty29jlMjPQ5hLJiIyx5ejtZkF87p7aiXvbD6/ZCvvRT6e68esL0WcIlz7HxhA3wtNly36p5Bnb9p0ybNkIt3cKX5MM0YfI1cel2npt7jHKzOnjI0GjXSxwCGWiBMI30MgMp9DwWacybOoeeNEIf4OhXNeh+H0NT7OIRG+jiERvo4hEb6OIRmvcchnqry45iDh9PLQ/Zz4HUKEi0KUpI5XGnksKz3m1GjoEl6nOGBvV7sa9ShzMghPckPoyiD90kw6IDpXg7vNkh4qbH/a2ikxxEe/dgBq8+Ai9KBQz4JHoceOhOPlCQRDad9KPcDmRDwcbOEre19e+k09R4nqLJJOOY1IQdO7KzwwZRugMXjQQdlzgQUZIhAU4cLgWYfkkx6vGkyYnFa7NeOaJIeJ1i7x4GL03m8eJ0ZWYlGfL3YhNduTkRxlhk3TrZg/Q0WWBwcbpiZglduMKG5JoD32mJfSyM9TtDa6kOyDvikBZDNPNr9wJt1wDk3UN4FvFVH78LlcNgO7GkFEgUexzzRKt7u8WPRE1s1N2y8YNnLTTDNyIBOlMEl8HC7ZPgCMhJMOgT8MqSADJFTYDDqwPn9sNl4TCnksXpSdKy9vsOlSXq8IDPVgPmpAl4u08HX7MN3C3V4Y74BBh+PS0wi/n6ZHnkBDjN0PF4uMyBV4FFq6p1ckZtq0kiPF9wwKxF7g6+czTMI2NmsfrboAEPQHLf6FcxOAfwK0OJTcH1ybAtei7LFEb76UgOS5mWD3iQqKeyN2pDp9cr07lj6W+TAyQqcdg6pehnPXRTbZNMMuTjCz5Zlo/1IJ5YmcEi3BZDmlJGnALM5wNPsxVITcLHCwdEp4ZmZfVOrSXqcYWONjJe3NKN4bjaanD7oE0RwggK9LMDvA2yuAH40C7hiQt8uGI10xB9opP7VXg/2fNYBpFnAiQI4tw/XTtbhe2X9r3Ch97L9Pyy1FYyF2eZOAAAAAElFTkSuQmCC`;

export const ManagementReportModal: React.FC<ManagementReportModalProps> = ({
    isOpen,
    onClose,
    salesPersonStats,
    performanceTotals,
    dateRangeLabel,
    currentUser,
    quotations = [],
    customerMap = new Map(),
    salesPersons = [],
}) => {
    const [copiedHtml, setCopiedHtml] = useState(false);
    const [copiedText, setCopiedText] = useState(false);
    const [copiedSubject, setCopiedSubject] = useState(false);
    const [activeTab, setActiveTab] = useState<'matrix' | 'top10' | 'preview'>('matrix');
    const contentRef = useRef<HTMLDivElement>(null);

    const reportDateStr = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });

    const emailSubject = `[Weekly Review] Siddhi Kabel Corporation - Offer Management & Enquiry Performance (${dateRangeLabel})`;

    // Helper for status percentage
    const calcPct = (part: number, total: number) => {
        if (!total || total <= 0) return '0.0%';
        return `${((part / total) * 100).toFixed(1)}%`;
    };

    // Overall summary metrics
    const totalEnqCount = performanceTotals.total.count || 0;
    const totalEnqVal = performanceTotals.total.value || 0;

    const openCount = performanceTotals['Open']?.count || 0;
    const openVal = performanceTotals['Open']?.value || 0;

    const poCount = performanceTotals['PO received']?.count || 0;
    const poVal = performanceTotals['PO received']?.value || 0;

    const partialPoCount = performanceTotals['Partial PO Received']?.count || 0;
    const partialPoVal = performanceTotals['Partial PO Received']?.value || 0;

    const underReviewCount = performanceTotals['Under Review']?.count || 0;
    const underReviewVal = performanceTotals['Under Review']?.value || 0;

    const amendCount = performanceTotals['Need Amendment']?.count || 0;
    const amendVal = performanceTotals['Need Amendment']?.value || 0;

    const lostCount = (performanceTotals['Lost']?.count || 0) + (performanceTotals['Expired']?.count || 0);
    const lostVal = (performanceTotals['Lost']?.value || 0) + (performanceTotals['Expired']?.value || 0);

    const winRateCountPct = calcPct(poCount + partialPoCount, totalEnqCount);
    const winRateValPct = calcPct(poVal + partialPoVal, totalEnqVal);
    const openPipelineValPct = calcPct(openVal, totalEnqVal);
    const reviewAmendCountPct = calcPct(underReviewCount + amendCount, totalEnqCount);

    // Compute Top 10 High Value Offers (Filtered for Latest 1 Month / 30 Days)
    const top10Offers = useMemo(() => {
        const list = [...(quotations || [])];
        const oneMonthAgo = new Date();
        oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
        oneMonthAgo.setHours(0, 0, 0, 0);

        // Filter for offers from the last 30 days
        let recentList = list.filter(q => {
            if (!q || calculateTotalAmount(q) <= 0) return false;
            if (!q.quotationDate) return false;
            const d = new Date(q.quotationDate);
            return !isNaN(d.getTime()) && d >= oneMonthAgo;
        });

        // If fewer than 5 offers in last 30 days, fall back to recent non-zero offers
        if (recentList.length < 5) {
            recentList = list.filter(q => q && calculateTotalAmount(q) > 0);
        }

        return recentList
            .sort((a, b) => calculateTotalAmount(b) - calculateTotalAmount(a))
            .slice(0, 10)
            .map((q, idx) => {
                const totalAmt = calculateTotalAmount(q);
                const qNum = generateFormattedQuotationNumber(q, quotations || []);
                const custName = q.customerId ? (customerMap.get(q.customerId) || (q as any).customerName || '—') : '—';
                const spName = salesPersons?.find(s => s.id === q.salesPersonId)?.name || '—';
                const qDate = q.quotationDate
                    ? new Date(q.quotationDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                    : '—';
                const appLink = `https://offer-managment.vercel.app/?id=${q.id}`;
                return {
                    rank: idx + 1,
                    id: q.id,
                    quotationNumber: qNum,
                    customerName: custName,
                    salesPerson: spName,
                    amount: totalAmt,
                    status: q.status,
                    date: qDate,
                    appLink,
                };
            });
    }, [quotations, customerMap, salesPersons]);

    if (!isOpen) return null;

    // Plain text version for WhatsApp / SMS / Plain email
    const generatePlainText = () => {
        let text = `Dear Sir,\n\n`;
        text += `Please find below the Quotation Management & Sales Enquiry Weekly Performance Review for ${dateRangeLabel} (${reportDateStr}).\n\n`;
        text += `📌 ACTION REQUIRED:\n`;
        text += `Please review your offers and update the status directly on the portal:\n`;
        text += `👉 https://offer-managment.vercel.app\n\n`;
        text += `==================================================\n`;
        text += `WEEKLY SALES & QUOTATION REVIEW DASHBOARD\n`;
        text += `Siddhi Kabel Corporation Pvt Ltd\n`;
        text += `==================================================\n`;
        text += `Subject: ${emailSubject}\n`;
        text += `Period: ${dateRangeLabel} | Date: ${reportDateStr}\n\n`;

        text += `--- 1. EXECUTIVE KPI SUMMARY ---\n`;
        text += `• Total Enquiries: ${totalEnqCount} | ${formatCurrencyCompact(totalEnqVal)} (100% Pipeline Base)\n`;
        text += `• PO Received (Won): ${poCount} | ${formatCurrencyCompact(poVal)} (${winRateValPct}) [Win Rate: ${winRateCountPct}]\n`;
        text += `• Open Offers: ${openCount} | ${formatCurrencyCompact(openVal)} (${calcPct(openCount, totalEnqCount)}) [${openPipelineValPct} of Pipeline]\n`;
        text += `• Review / Amend: ${underReviewCount + amendCount} | ${formatCurrencyCompact(underReviewVal + amendVal)} (${reviewAmendCountPct})\n\n`;

        text += `--- 2. SALES PERSON PERFORMANCE & STATUS MATRIX ---\n`;
        salesPersonStats.forEach(sp => {
            const spLostCount = (sp['Lost']?.count || 0) + (sp['Expired']?.count || 0);
            const spLostVal = (sp['Lost']?.value || 0) + (sp['Expired']?.value || 0);
            text += `👤 ${sp.name.toUpperCase()}\n`;
            text += `   • Total: ${sp.total.count} (${calcPct(sp.total.count, totalEnqCount)} of co.) | ${formatCurrencyCompact(sp.total.value)}\n`;
            text += `   • Open Offers: ${sp['Open']?.count || 0} (${calcPct(sp['Open']?.count || 0, sp.total.count)}) | ${formatCurrencyCompact(sp['Open']?.value || 0)} (${calcPct(sp['Open']?.value || 0, sp.total.value)})\n`;
            text += `   • PO Received: ${sp['PO received']?.count || 0} (${calcPct(sp['PO received']?.count || 0, sp.total.count)}) | ${formatCurrencyCompact(sp['PO received']?.value || 0)} (${calcPct(sp['PO received']?.value || 0, sp.total.value)})\n`;
            text += `   • Partial PO: ${sp['Partial PO Received']?.count || 0} (${calcPct(sp['Partial PO Received']?.count || 0, sp.total.count)}) | ${formatCurrencyCompact(sp['Partial PO Received']?.value || 0)}\n`;
            text += `   • Under Review: ${sp['Under Review']?.count || 0} (${calcPct(sp['Under Review']?.count || 0, sp.total.count)}) | ${formatCurrencyCompact(sp['Under Review']?.value || 0)}\n`;
            text += `   • Need Amend: ${sp['Need Amendment']?.count || 0} (${calcPct(sp['Need Amendment']?.count || 0, sp.total.count)}) | ${formatCurrencyCompact(sp['Need Amendment']?.value || 0)}\n`;
            text += `   • Lost/Expired: ${spLostCount} (${calcPct(spLostCount, sp.total.count)}) | ${formatCurrencyCompact(spLostVal)}\n\n`;
        });

        text += `--- 3. TOP 10 HIGH-VALUE OFFERS (LATEST 1 MONTH) ---\n`;
        top10Offers.forEach(o => {
            text += `#${o.rank}. ${o.quotationNumber} | ${formatCurrency(o.amount)}\n`;
            text += `    Customer: ${o.customerName}\n`;
            text += `    Sales Person: ${o.salesPerson} | Status: ${o.status} | Date: ${o.date}\n`;
            text += `    App Link: ${o.appLink}\n\n`;
        });

        text += `--------------------------------------------------\n`;
        text += `GRAND TOTAL: ${totalEnqCount} Enquiries | Value: ${formatCurrency(totalEnqVal)}\n\n`;
        text += `Thanks & Best Regards,\n\n`;
        text += `Kumar N\n`;
        text += `Sales Co-Ordinator\n`;
        text += `Siddhi Kabel Corporation Pvt Ltd\n`;
        text += `✉ sales@siddhikabel.com\n`;
        text += `📞 9620000947 / 9886058511\n`;
        text += `📍 #3, 1st Main, 1st Block, BSK 3rd Stage, Bangalore – 560 085\n`;
        text += `🌐 www.siddhikabel.com\n`;
        return text;
    };

    const handleCopyHtml = async () => {
        if (!contentRef.current) return;
        const html = contentRef.current.innerHTML;
        const plain = generatePlainText();

        try {
            if (navigator.clipboard && window.ClipboardItem) {
                const blobHtml = new Blob([html], { type: 'text/html' });
                const blobText = new Blob([plain], { type: 'text/plain' });
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'text/html': blobHtml,
                        'text/plain': blobText,
                    }),
                ]);
            } else {
                await navigator.clipboard.writeText(plain);
            }
            setCopiedHtml(true);
            setTimeout(() => setCopiedHtml(false), 2500);
        } catch (e) {
            console.error("Clipboard copy failed:", e);
            try {
                await navigator.clipboard.writeText(plain);
                setCopiedHtml(true);
                setTimeout(() => setCopiedHtml(false), 2500);
            } catch (_) {
                alert("Failed to copy automatically. Please select text manually.");
            }
        }
    };

    const handleCopyText = async () => {
        const plain = generatePlainText();
        try {
            await navigator.clipboard.writeText(plain);
            setCopiedText(true);
            setTimeout(() => setCopiedText(false), 2500);
        } catch (e) {
            alert("Failed to copy text.");
        }
    };

    const handleCopySubject = async () => {
        try {
            await navigator.clipboard.writeText(emailSubject);
            setCopiedSubject(true);
            setTimeout(() => setCopiedSubject(false), 2500);
        } catch (e) {
            alert("Failed to copy subject.");
        }
    };

    const handleWhatsApp = () => {
        const text = generatePlainText();
        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col border border-slate-200 my-auto max-h-[94vh]">
                
                {/* Header */}
                <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white flex justify-between items-center shrink-0 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-xl shadow-inner">
                            📊
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-black text-white text-base sm:text-lg tracking-wide">
                                    Management Weekly Review Dashboard
                                </h3>
                                <span className="bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-xs font-bold px-2.5 py-0.5 rounded-full">
                                    {dateRangeLabel}
                                </span>
                            </div>
                            <p className="text-xs text-slate-300 mt-0.5">
                                Executive Performance Matrix • Offer Status % Breakdown • Top 10 High Value Offers (Latest 1 Mo)
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors"
                        title="Close"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Toolbar & Action Bar */}
                <div className="bg-slate-50 border-b border-slate-200 p-3 sm:px-6 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    {/* View Switcher Tabs */}
                    <div className="inline-flex bg-slate-200/80 p-1 rounded-xl gap-1 text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => setActiveTab('matrix')}
                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                activeTab === 'matrix'
                                    ? 'bg-white text-indigo-700 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            📊 Performance Matrix (%)
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('top10')}
                            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                                activeTab === 'top10'
                                    ? 'bg-white text-indigo-700 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            🏆 Top 10 Offers (Latest 1 Mo)
                            <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded-full text-[10px]">{top10Offers.length}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('preview')}
                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                activeTab === 'preview'
                                    ? 'bg-white text-indigo-700 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            ✉️ Full Email Preview
                        </button>
                    </div>

                    {/* Quick Copy Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={handleCopyHtml}
                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all shadow-sm flex items-center gap-1.5 ${
                                copiedHtml
                                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-md'
                            }`}
                            title="Copy styled email ready to paste directly into Outlook or Gmail"
                        >
                            {copiedHtml ? '✓ Rich Email Copied!' : '📋 Copy Rich Email (Outlook / Gmail)'}
                        </button>

                        <button
                            type="button"
                            onClick={handleCopySubject}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1 ${
                                copiedSubject
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                            title="Copy email subject line"
                        >
                            {copiedSubject ? '✓ Subject Copied!' : '✉️ Copy Subject'}
                        </button>

                        <button
                            type="button"
                            onClick={handleCopyText}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                                copiedText
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                            title="Copy plain text summary"
                        >
                            {copiedText ? '✓ Text Copied!' : '📄 Plain Text'}
                        </button>

                        <button
                            type="button"
                            onClick={handleWhatsApp}
                            className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors flex items-center gap-1"
                        >
                            <span>WhatsApp</span>
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
                    
                    {/* Top Executive KPI Cards Summary (Always visible - Image 3 Format) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {/* Card 1: Total Enquiries */}
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50/40 border border-blue-200/70 rounded-2xl p-3.5 shadow-xs">
                            <div className="flex justify-between items-start">
                                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">TOTAL ENQUIRIES</span>
                                <span className="text-[10px] bg-blue-100 text-blue-800 font-extrabold px-1.5 py-0.5 rounded">100%</span>
                            </div>
                            <div className="text-2xl font-black text-slate-800 mt-1">{totalEnqCount}</div>
                            <div className="text-xs font-bold text-blue-700 mt-0.5">{formatCurrencyCompact(totalEnqVal)}</div>
                            <div className="text-[10px] text-slate-500 mt-1 font-medium">Pipeline volume</div>
                        </div>

                        {/* Card 2: PO Received (Won) */}
                        <div className="bg-gradient-to-br from-emerald-50 to-teal-50/40 border border-emerald-200/70 rounded-2xl p-3.5 shadow-xs">
                            <div className="flex justify-between items-start">
                                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">PO RECEIVED (WON)</span>
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded">
                                    {winRateCountPct} Win
                                </span>
                            </div>
                            <div className="text-2xl font-black text-slate-800 mt-1">{poCount}</div>
                            <div className="text-xs font-bold text-emerald-700 mt-0.5">
                                {formatCurrencyCompact(poVal)} <span className="text-[10px] text-emerald-600 font-semibold">({winRateValPct})</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1 font-medium">Closed orders confirmed</div>
                        </div>

                        {/* Card 3: Open Offers */}
                        <div className="bg-gradient-to-br from-indigo-50 to-blue-50/40 border border-indigo-200/70 rounded-2xl p-3.5 shadow-xs">
                            <div className="flex justify-between items-start">
                                <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">OPEN OFFERS</span>
                                <span className="text-[10px] bg-indigo-100 text-indigo-800 font-extrabold px-1.5 py-0.5 rounded">
                                    {openPipelineValPct} Val
                                </span>
                            </div>
                            <div className="text-2xl font-black text-slate-800 mt-1">{openCount}</div>
                            <div className="text-xs font-bold text-indigo-700 mt-0.5">
                                {formatCurrencyCompact(openVal)} <span className="text-[10px] text-indigo-600 font-semibold">({calcPct(openCount, totalEnqCount)})</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1 font-medium">Active offers in negotiation</div>
                        </div>

                        {/* Card 4: Review / Amend */}
                        <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 border border-amber-200/70 rounded-2xl p-3.5 shadow-xs">
                            <div className="flex justify-between items-start">
                                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">REVIEW / AMEND</span>
                                <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-1.5 py-0.5 rounded">Action</span>
                            </div>
                            <div className="text-2xl font-black text-slate-800 mt-1">{underReviewCount + amendCount}</div>
                            <div className="text-xs font-bold text-amber-700 mt-0.5">
                                {formatCurrencyCompact(underReviewVal + amendVal)} <span className="text-[10px] text-amber-600 font-semibold">({reviewAmendCountPct})</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1 font-medium">Pending technical/price revision</div>
                        </div>
                    </div>

                    {/* TAB 1: Performance Matrix with Status % (LIGHTER CLEAN HEADER) */}
                    {activeTab === 'matrix' && (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h4 className="text-sm font-black text-slate-800 tracking-wide uppercase">
                                        Sales Person Enquiry &amp; Offer Status Breakdown
                                    </h4>
                                    <p className="text-xs text-slate-500">
                                        Each cell shows <strong>Count (% share)</strong> and <strong>Value (% share)</strong> of the sales person's total enquiries.
                                    </p>
                                </div>
                                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                                    {salesPersonStats.length} Sales Persons
                                </span>
                            </div>

                            <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-xs">
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100 text-slate-900 font-extrabold border-b-2 border-slate-300">
                                            <th className="p-3 border-r border-slate-200 text-slate-900 bg-slate-200/70">
                                                Sales Person
                                            </th>
                                            <th className="p-3 text-center border-r border-slate-200 bg-slate-100 text-slate-900">
                                                Total Enquiry<br/>
                                                <span className="text-[10px] text-slate-500 font-normal">Count / Value</span>
                                            </th>
                                            <th className="p-3 text-center border-r border-slate-200 bg-blue-50/80 text-blue-900">
                                                Open Offer<br/>
                                                <span className="text-[10px] text-blue-600 font-normal">Count / Value (%)</span>
                                            </th>
                                            <th className="p-3 text-center border-r border-slate-200 bg-emerald-50/80 text-emerald-900">
                                                PO Received<br/>
                                                <span className="text-[10px] text-emerald-600 font-normal">Count / Value (%)</span>
                                            </th>
                                            <th className="p-3 text-center border-r border-slate-200 bg-teal-50/80 text-teal-900">
                                                Partial PO<br/>
                                                <span className="text-[10px] text-teal-600 font-normal">Count / Value (%)</span>
                                            </th>
                                            <th className="p-3 text-center border-r border-slate-200 bg-indigo-50/80 text-indigo-900">
                                                Under Review<br/>
                                                <span className="text-[10px] text-indigo-600 font-normal">Count / Value (%)</span>
                                            </th>
                                            <th className="p-3 text-center border-r border-slate-200 bg-purple-50/80 text-purple-900">
                                                Amendment<br/>
                                                <span className="text-[10px] text-purple-600 font-normal">Count / Value (%)</span>
                                            </th>
                                            <th className="p-3 text-center bg-rose-50/80 text-rose-900">
                                                Lost / Expired<br/>
                                                <span className="text-[10px] text-rose-600 font-normal">Count / Value (%)</span>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 bg-white">
                                        {salesPersonStats.map((sp, idx) => {
                                            const spTotalCount = sp.total.count || 0;
                                            const spTotalVal = sp.total.value || 0;

                                            const spOpenCount = sp['Open']?.count || 0;
                                            const spOpenVal = sp['Open']?.value || 0;

                                            const spPoCount = sp['PO received']?.count || 0;
                                            const spPoVal = sp['PO received']?.value || 0;

                                            const spPartialCount = sp['Partial PO Received']?.count || 0;
                                            const spPartialVal = sp['Partial PO Received']?.value || 0;

                                            const spReviewCount = sp['Under Review']?.count || 0;
                                            const spReviewVal = sp['Under Review']?.value || 0;

                                            const spAmendCount = sp['Need Amendment']?.count || 0;
                                            const spAmendVal = sp['Need Amendment']?.value || 0;

                                            const spLostCount = (sp['Lost']?.count || 0) + (sp['Expired']?.count || 0);
                                            const spLostVal = (sp['Lost']?.value || 0) + (sp['Expired']?.value || 0);

                                            return (
                                                <tr key={sp.id} className={idx % 2 === 0 ? 'bg-white hover:bg-slate-50/80' : 'bg-slate-50/50 hover:bg-slate-50/80'}>
                                                    <td className="p-3 font-bold text-slate-800 border-r border-slate-200">
                                                        <div className="font-extrabold text-slate-900">{sp.name}</div>
                                                        <div className="text-[10px] text-slate-500 font-normal">
                                                            {calcPct(spTotalCount, totalEnqCount)} of co. enquiries
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-center border-r border-slate-200 bg-slate-50 font-bold text-slate-900">
                                                        <div className="text-sm font-black">{spTotalCount}</div>
                                                        <div className="text-[11px] text-indigo-700 font-bold">{formatCurrencyCompact(spTotalVal)}</div>
                                                    </td>
                                                    <td className="p-3 text-center border-r border-slate-200 bg-blue-50/20">
                                                        <div className="font-bold text-blue-900">
                                                            {spOpenCount} <span className="text-[10px] text-blue-600 font-semibold">({calcPct(spOpenCount, spTotalCount)})</span>
                                                        </div>
                                                        <div className="text-[11px] text-blue-700 font-semibold">
                                                            {formatCurrencyCompact(spOpenVal)} <span className="text-[10px] text-slate-500">({calcPct(spOpenVal, spTotalVal)})</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-center border-r border-slate-200 bg-emerald-50/30">
                                                        <div className="font-extrabold text-emerald-900">
                                                            {spPoCount} <span className="text-[10px] text-emerald-600 font-bold">({calcPct(spPoCount, spTotalCount)})</span>
                                                        </div>
                                                        <div className="text-[11px] text-emerald-700 font-bold">
                                                            {formatCurrencyCompact(spPoVal)} <span className="text-[10px] text-emerald-600">({calcPct(spPoVal, spTotalVal)})</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-center border-r border-slate-200 bg-teal-50/20">
                                                        <div className="font-bold text-teal-900">
                                                            {spPartialCount} <span className="text-[10px] text-teal-600">({calcPct(spPartialCount, spTotalCount)})</span>
                                                        </div>
                                                        <div className="text-[11px] text-teal-700">
                                                            {formatCurrencyCompact(spPartialVal)} <span className="text-[10px] text-slate-500">({calcPct(spPartialVal, spTotalVal)})</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-center border-r border-slate-200 bg-indigo-50/20">
                                                        <div className="font-bold text-indigo-900">
                                                            {spReviewCount} <span className="text-[10px] text-indigo-600">({calcPct(spReviewCount, spTotalCount)})</span>
                                                        </div>
                                                        <div className="text-[11px] text-indigo-700">
                                                            {formatCurrencyCompact(spReviewVal)} <span className="text-[10px] text-slate-500">({calcPct(spReviewVal, spTotalVal)})</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-center border-r border-slate-200 bg-purple-50/20">
                                                        <div className="font-bold text-purple-900">
                                                            {spAmendCount} <span className="text-[10px] text-purple-600">({calcPct(spAmendCount, spTotalCount)})</span>
                                                        </div>
                                                        <div className="text-[11px] text-purple-700">
                                                            {formatCurrencyCompact(spAmendVal)} <span className="text-[10px] text-slate-500">({calcPct(spAmendVal, spTotalVal)})</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-center bg-rose-50/20">
                                                        <div className="font-bold text-rose-900">
                                                            {spLostCount} <span className="text-[10px] text-rose-600">({calcPct(spLostCount, spTotalCount)})</span>
                                                        </div>
                                                        <div className="text-[11px] text-rose-700">
                                                            {formatCurrencyCompact(spLostVal)} <span className="text-[10px] text-slate-500">({calcPct(spLostVal, spTotalVal)})</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-slate-100 text-slate-900 font-extrabold border-t-2 border-b-2 border-slate-400">
                                            <td className="p-3 text-left border-r border-slate-300 text-slate-900">
                                                <div className="font-black tracking-wider">COMPANY TOTAL</div>
                                                <div className="text-[10px] text-slate-600 font-normal">All sales combined</div>
                                            </td>
                                            <td className="p-3 text-center border-r border-slate-300 bg-slate-200/80 text-slate-900">
                                                <div className="text-sm font-black">{totalEnqCount} (100%)</div>
                                                <div className="text-[11px] font-bold text-indigo-900">{formatCurrencyCompact(totalEnqVal)}</div>
                                            </td>
                                            <td className="p-3 text-center border-r border-slate-300 bg-blue-100/70 text-blue-900">
                                                <div className="font-bold">{openCount} ({calcPct(openCount, totalEnqCount)})</div>
                                                <div className="text-[11px] text-blue-800 font-bold">{formatCurrencyCompact(openVal)} ({calcPct(openVal, totalEnqVal)})</div>
                                            </td>
                                            <td className="p-3 text-center border-r border-slate-300 bg-emerald-100/70 text-emerald-900">
                                                <div className="font-black text-emerald-950">{poCount} ({calcPct(poCount, totalEnqCount)})</div>
                                                <div className="text-[11px] text-emerald-900 font-extrabold">{formatCurrencyCompact(poVal)} ({calcPct(poVal, totalEnqVal)})</div>
                                            </td>
                                            <td className="p-3 text-center border-r border-slate-300 bg-teal-100/70 text-teal-900">
                                                <div className="font-bold">{partialPoCount} ({calcPct(partialPoCount, totalEnqCount)})</div>
                                                <div className="text-[11px] text-teal-800 font-bold">{formatCurrencyCompact(partialPoVal)}</div>
                                            </td>
                                            <td className="p-3 text-center border-r border-slate-300 bg-indigo-100/70 text-indigo-900">
                                                <div className="font-bold">{underReviewCount} ({calcPct(underReviewCount, totalEnqCount)})</div>
                                                <div className="text-[11px] text-indigo-800">{formatCurrencyCompact(underReviewVal)}</div>
                                            </td>
                                            <td className="p-3 text-center border-r border-slate-300 bg-purple-100/70 text-purple-900">
                                                <div className="font-bold">{amendCount} ({calcPct(amendCount, totalEnqCount)})</div>
                                                <div className="text-[11px] text-purple-800">{formatCurrencyCompact(amendVal)}</div>
                                            </td>
                                            <td className="p-3 text-center bg-rose-100/70 text-rose-900">
                                                <div className="font-bold">{lostCount} ({calcPct(lostCount, totalEnqCount)})</div>
                                                <div className="text-[11px] text-rose-800">{formatCurrencyCompact(lostVal)}</div>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: Latest 10 High Value Offers (Last 1 Month - LIGHTER HEADER) */}
                    {activeTab === 'top10' && (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h4 className="text-sm font-black text-slate-800 tracking-wide uppercase">
                                        Top 10 High-Value Quotations &amp; Opportunities (Latest 1 Month)
                                    </h4>
                                    <p className="text-xs text-slate-500">
                                        Highest-value offers quoted in the last 30 days with direct 1-click app links.
                                    </p>
                                </div>
                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-lg">
                                    Last 30 Days Window
                                </span>
                            </div>

                            <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-xs">
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100 text-slate-900 font-extrabold border-b-2 border-slate-300">
                                            <th className="p-3 text-center border-r border-slate-200 text-slate-900 w-12">#</th>
                                            <th className="p-3 border-r border-slate-200 text-slate-900">Quotation No</th>
                                            <th className="p-3 border-r border-slate-200 text-slate-900">Customer Name</th>
                                            <th className="p-3 border-r border-slate-200 text-slate-900">Sales Person</th>
                                            <th className="p-3 text-right border-r border-slate-200 text-slate-900">Offer Value (₹)</th>
                                            <th className="p-3 text-center border-r border-slate-200 text-slate-900">Status</th>
                                            <th className="p-3 text-center border-r border-slate-200 text-slate-900">Date</th>
                                            <th className="p-3 text-center text-slate-900">Direct App Link</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 bg-white">
                                        {top10Offers.map((offer) => {
                                            const isWon = offer.status === 'PO received' || offer.status === 'Partial PO Received';
                                            const isOpen = offer.status === 'Open';
                                            const isReview = offer.status === 'Under Review' || offer.status === 'Need Amendment';

                                            return (
                                                <tr key={offer.id} className="hover:bg-indigo-50/40 transition-colors">
                                                    <td className="p-3 text-center font-extrabold text-slate-400 border-r border-slate-200">
                                                        {offer.rank}
                                                    </td>
                                                    <td className="p-3 font-bold text-indigo-600 border-r border-slate-200 whitespace-nowrap">
                                                        {offer.quotationNumber}
                                                    </td>
                                                    <td className="p-3 font-bold text-slate-800 border-r border-slate-200 max-w-[220px] truncate" title={offer.customerName}>
                                                        {offer.customerName}
                                                    </td>
                                                    <td className="p-3 font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                                                        {offer.salesPerson}
                                                    </td>
                                                    <td className="p-3 text-right font-black text-slate-900 border-r border-slate-200 whitespace-nowrap">
                                                        <div className="text-indigo-700 font-extrabold">{formatCurrency(offer.amount)}</div>
                                                        <div className="text-[10px] text-slate-500 font-normal">{formatCurrencyCompact(offer.amount)}</div>
                                                    </td>
                                                    <td className="p-3 text-center border-r border-slate-200">
                                                        <span className={`inline-flex px-2.5 py-1 text-[11px] font-bold rounded-full ${
                                                            isWon
                                                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                                                : isOpen
                                                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                                                : isReview
                                                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                                                : 'bg-rose-100 text-rose-800 border border-rose-300'
                                                        }`}>
                                                            {offer.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center text-slate-600 font-medium border-r border-slate-200 whitespace-nowrap">
                                                        {offer.date}
                                                    </td>
                                                    <td className="p-3 text-center whitespace-nowrap">
                                                        <a
                                                            href={offer.appLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-bold px-3 py-1 rounded-lg border border-indigo-200 transition-colors shadow-2xs"
                                                        >
                                                            <span>Open Offer</span>
                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                            </svg>
                                                        </a>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: Complete Draft Email Preview */}
                    {activeTab === 'preview' && (
                        <div className="space-y-4">
                            <div className="bg-slate-100 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
                                <div>
                                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Subject Line:</div>
                                    <div className="text-xs font-bold text-slate-800 select-all mt-0.5">{emailSubject}</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCopySubject}
                                    className="px-3 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg shadow-2xs"
                                >
                                    {copiedSubject ? '✓ Copied' : 'Copy'}
                                </button>
                            </div>

                            <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-6 shadow-xs max-h-[600px] overflow-y-auto">
                                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">
                                    Email Body Preview (Exact format copied to clipboard):
                                </div>
                                
                                <div className="prose max-w-none text-xs text-slate-700 space-y-4">
                                    <p className="text-sm font-semibold text-slate-900">Dear Sir,</p>
                                    <p>
                                        Please find below the Quotation Management &amp; Sales Enquiry Weekly Performance Review for <strong>{dateRangeLabel}</strong> ({reportDateStr}).
                                    </p>
                                    
                                    {/* Action Required Banner at Top */}
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-amber-900">
                                        <div className="text-xs">
                                            <strong>⚡ Action Required:</strong> Please review your offers and update the current status on the portal.
                                        </div>
                                        <a
                                            href="https://offer-managment.vercel.app"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-xs whitespace-nowrap"
                                        >
                                            Review Offers &amp; Update Status ↗
                                        </a>
                                    </div>

                                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                        <strong>Executive Highlights:</strong>
                                        <ul className="list-disc pl-5 mt-1 space-y-0.5">
                                            <li>Total Enquiries: <strong>{totalEnqCount}</strong> ({formatCurrencyCompact(totalEnqVal)})</li>
                                            <li>Orders Won (PO Received): <strong>{poCount}</strong> ({formatCurrencyCompact(poVal)}) — Win Rate: <strong>{winRateCountPct}</strong></li>
                                            <li>Active Open Offers: <strong>{openCount}</strong> ({formatCurrencyCompact(openVal)}) — <strong>{openPipelineValPct}</strong> of total value</li>
                                            <li>Review / Amend: <strong>{underReviewCount + amendCount}</strong> ({formatCurrencyCompact(underReviewVal + amendVal)})</li>
                                        </ul>
                                    </div>

                                    <p className="font-bold text-slate-800">1. Sales Person Performance &amp; Status Breakdown Matrix</p>
                                    <p className="text-[11px] text-slate-500 italic">[Clean light table with dark high-contrast headings and % share]</p>

                                    <p className="font-bold text-slate-800">2. Top 10 High-Value Offers (Latest 1 Month - With 1-Click App Links)</p>
                                    <p className="text-[11px] text-slate-500 italic">[Top 10 highest-value offers with customer, sales person, value, and direct app links]</p>

                                    {/* Signature Preview Matching Image 2 */}
                                    <div className="pt-4 border-t border-slate-200">
                                        <div className="flex items-start gap-4">
                                            <img
                                                src={SIDDHI_LOGO_BASE64}
                                                alt="Siddhi"
                                                className="w-20 h-20 object-contain border border-slate-200 rounded p-1 bg-white shrink-0"
                                            />
                                            <div className="text-xs text-slate-800 space-y-0.5">
                                                <div className="font-bold text-slate-900 text-sm">Kumar N</div>
                                                <div className="font-bold text-slate-800">Sales Co-Ordinator</div>
                                                <div className="font-bold text-slate-800 pb-1">Siddhi Kabel Corporation Pvt Ltd</div>
                                                <div className="text-slate-600">
                                                    ✉ <a href="mailto:sales@siddhikabel.com" className="text-blue-600 underline font-medium">sales@siddhikabel.com</a>
                                                </div>
                                                <div className="text-slate-600">
                                                    📞 9620000947 / 9886058511
                                                </div>
                                                <div className="text-slate-600">
                                                    📍 #3, 1st Main, 1st Block, BSK 3rd Stage, Bangalore – 560 085
                                                </div>
                                                <div className="text-slate-600">
                                                    🌐 <a href="http://www.siddhikabel.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-medium">www.siddhikabel.com</a>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* HIDDEN INLINE-STYLED HTML CONTAINER FOR PERFECT CLIPBOARD COPY (GMAIL & OUTLOOK) */}
                <div ref={contentRef} style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
                    <div style={{ fontFamily: 'Segoe UI, Helvetica, Arial, sans-serif', color: '#1e293b', maxWidth: '900px', padding: '20px', backgroundColor: '#ffffff' }}>
                        
                        {/* 1. GREETING - Dear Sir, */}
                        <p style={{ margin: '0 0 10px 0', fontSize: '15px', color: '#0f172a', fontWeight: 'bold' }}>
                            Dear Sir,
                        </p>
                        <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                            Please find below the Quotation Management &amp; Sales Enquiry Weekly Performance Review for <strong>{dateRangeLabel}</strong> ({reportDateStr}).
                        </p>

                        {/* Top Action Required Callout Banner with Link */}
                        <table width="100%" cellPadding="0" cellSpacing="0" border={0} style={{ width: '100%', marginBottom: '18px', backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px' }}>
                            <tbody>
                                <tr>
                                    <td style={{ padding: '12px 14px', fontSize: '13px', color: '#92400e' }}>
                                        <font color="#92400e">
                                            <strong>📌 Action Required:</strong> Please review your offers and update the status directly on the portal:&nbsp;
                                        </font>
                                        <a
                                            href="https://offer-managment.vercel.app"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                color: '#ffffff',
                                                backgroundColor: '#4338ca',
                                                fontWeight: 'bold',
                                                textDecoration: 'none',
                                                padding: '6px 14px',
                                                borderRadius: '6px',
                                                display: 'inline-block',
                                                fontSize: '12px',
                                                marginLeft: '8px',
                                            }}
                                        >
                                            <font color="#ffffff"><b>Review Offers &amp; Update Status ↗</b></font>
                                        </a>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Title Bar */}
                        <div style={{ borderBottom: '2px solid #4338ca', paddingBottom: '10px', marginBottom: '16px' }}>
                            <h2 style={{ margin: '0 0 4px 0', color: '#0f172a', fontSize: '18px', fontWeight: 'bold' }}>
                                Quotation &amp; Offer Management - Executive Performance Review
                            </h2>
                            <p style={{ margin: '0', fontSize: '12px', color: '#64748b' }}>
                                <strong>Company:</strong> Siddhi Kabel Corporation Pvt Ltd &nbsp;|&nbsp; <strong>Period:</strong> {dateRangeLabel} &nbsp;|&nbsp; <strong>Date:</strong> {reportDateStr}
                            </p>
                        </div>

                        {/* 2. EXECUTIVE KPI CARDS TABLE (EXACT IMAGE 3 FORMAT WITH PILLS & COMPACT VALUES) */}
                        <table width="100%" cellPadding="0" cellSpacing="0" border={0} style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '8px 0', marginBottom: '22px' }}>
                            <tbody>
                                <tr>
                                    {/* Card 1: TOTAL ENQUIRIES */}
                                    <td width="25%" valign="top" style={{ width: '25%', padding: '12px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px' }}>
                                        <table width="100%" cellPadding="0" cellSpacing="0" border={0}>
                                            <tbody>
                                                <tr>
                                                    <td align="left" style={{ fontSize: '11px', fontWeight: 'bold', color: '#1d4ed8', textTransform: 'uppercase' }}>
                                                        <font color="#1d4ed8"><b>TOTAL ENQUIRIES</b></font>
                                                    </td>
                                                    <td align="right">
                                                        <span style={{ backgroundColor: '#dbeafe', color: '#1e40af', fontSize: '10px', fontWeight: 'bold', padding: '2px 7px', borderRadius: '6px', display: 'inline-block' }}>
                                                            <font color="#1e40af"><b>100%</b></font>
                                                        </span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={2} style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a', padding: '6px 0 2px 0' }}>
                                                        <font color="#0f172a"><b>{totalEnqCount}</b></font>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={2} style={{ fontSize: '13px', fontWeight: 'bold', color: '#1d4ed8' }}>
                                                        <font color="#1d4ed8"><b>{formatCurrencyCompact(totalEnqVal)}</b></font>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={2} style={{ fontSize: '10px', color: '#64748b', paddingTop: '4px' }}>
                                                        <font color="#64748b">Pipeline volume</font>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </td>

                                    {/* Card 2: PO RECEIVED (WON) */}
                                    <td width="25%" valign="top" style={{ width: '25%', padding: '12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px' }}>
                                        <table width="100%" cellPadding="0" cellSpacing="0" border={0}>
                                            <tbody>
                                                <tr>
                                                    <td align="left" style={{ fontSize: '11px', fontWeight: 'bold', color: '#15803d', textTransform: 'uppercase' }}>
                                                        <font color="#15803d"><b>PO RECEIVED (WON)</b></font>
                                                    </td>
                                                    <td align="right">
                                                        <span style={{ backgroundColor: '#dcfce7', color: '#166534', fontSize: '10px', fontWeight: 'bold', padding: '2px 7px', borderRadius: '6px', display: 'inline-block' }}>
                                                            <font color="#166534"><b>{winRateCountPct} Win</b></font>
                                                        </span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={2} style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a', padding: '6px 0 2px 0' }}>
                                                        <font color="#0f172a"><b>{poCount}</b></font>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={2} style={{ fontSize: '13px', fontWeight: 'bold', color: '#15803d' }}>
                                                        <font color="#15803d"><b>{formatCurrencyCompact(poVal)}</b></font>
                                                        &nbsp;<font color="#16a34a"><span style={{ fontSize: '11px', fontWeight: '600' }}>({winRateValPct})</span></font>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={2} style={{ fontSize: '10px', color: '#64748b', paddingTop: '4px' }}>
                                                        <font color="#64748b">Closed orders confirmed</font>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </td>

                                    {/* Card 3: OPEN OFFERS */}
                                    <td width="25%" valign="top" style={{ width: '25%', padding: '12px', backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '12px' }}>
                                        <table width="100%" cellPadding="0" cellSpacing="0" border={0}>
                                            <tbody>
                                                <tr>
                                                    <td align="left" style={{ fontSize: '11px', fontWeight: 'bold', color: '#4338ca', textTransform: 'uppercase' }}>
                                                        <font color="#4338ca"><b>OPEN OFFERS</b></font>
                                                    </td>
                                                    <td align="right">
                                                        <span style={{ backgroundColor: '#ede9fe', color: '#5b21b6', fontSize: '10px', fontWeight: 'bold', padding: '2px 7px', borderRadius: '6px', display: 'inline-block' }}>
                                                            <font color="#5b21b6"><b>{openPipelineValPct} Val</b></font>
                                                        </span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={2} style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a', padding: '6px 0 2px 0' }}>
                                                        <font color="#0f172a"><b>{openCount}</b></font>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={2} style={{ fontSize: '13px', fontWeight: 'bold', color: '#4338ca' }}>
                                                        <font color="#4338ca"><b>{formatCurrencyCompact(openVal)}</b></font>
                                                        &nbsp;<font color="#6366f1"><span style={{ fontSize: '11px', fontWeight: '600' }}>({calcPct(openCount, totalEnqCount)})</span></font>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={2} style={{ fontSize: '10px', color: '#64748b', paddingTop: '4px' }}>
                                                        <font color="#64748b">Active offers in negotiation</font>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </td>

                                    {/* Card 4: REVIEW / AMEND */}
                                    <td width="25%" valign="top" style={{ width: '25%', padding: '12px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px' }}>
                                        <table width="100%" cellPadding="0" cellSpacing="0" border={0}>
                                            <tbody>
                                                <tr>
                                                    <td align="left" style={{ fontSize: '11px', fontWeight: 'bold', color: '#b45309', textTransform: 'uppercase' }}>
                                                        <font color="#b45309"><b>REVIEW / AMEND</b></font>
                                                    </td>
                                                    <td align="right">
                                                        <span style={{ backgroundColor: '#fef3c7', color: '#92400e', fontSize: '10px', fontWeight: 'bold', padding: '2px 7px', borderRadius: '6px', display: 'inline-block' }}>
                                                            <font color="#92400e"><b>Action</b></font>
                                                        </span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={2} style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a', padding: '6px 0 2px 0' }}>
                                                        <font color="#0f172a"><b>{underReviewCount + amendCount}</b></font>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={2} style={{ fontSize: '13px', fontWeight: 'bold', color: '#b45309' }}>
                                                        <font color="#b45309"><b>{formatCurrencyCompact(underReviewVal + amendVal)}</b></font>
                                                        &nbsp;<font color="#d97706"><span style={{ fontSize: '11px', fontWeight: '600' }}>({reviewAmendCountPct})</span></font>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={2} style={{ fontSize: '10px', color: '#64748b', paddingTop: '4px' }}>
                                                        <font color="#64748b">Pending technical/price revision</font>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {/* SECTION 1: Performance Matrix Table (LIGHTER HIGH-CONTRAST HEADERS) */}
                        <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            1. Sales Person Enquiry &amp; Status Breakdown Matrix
                        </h3>
                        
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #cbd5e1', marginBottom: '24px' }}>
                            <thead>
                                <tr bgcolor="#f1f5f9" style={{ backgroundColor: '#f1f5f9' }}>
                                    <td bgcolor="#f1f5f9" align="left" style={{ backgroundColor: '#f1f5f9', color: '#0f172a', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #cbd5e1', fontSize: '12px' }}>
                                        <font color="#0f172a"><b>Sales Person</b></font>
                                    </td>
                                    <td bgcolor="#f1f5f9" align="center" style={{ backgroundColor: '#f1f5f9', color: '#0f172a', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #cbd5e1', fontSize: '12px' }}>
                                        <font color="#0f172a"><b>Total Enquiry</b></font><br/>
                                        <font color="#475569"><span style={{ fontSize: '10px', color: '#475569' }}>Count / Val</span></font>
                                    </td>
                                    <td bgcolor="#dbeafe" align="center" style={{ backgroundColor: '#dbeafe', color: '#1e40af', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #bfdbfe', fontSize: '12px' }}>
                                        <font color="#1e40af"><b>Open Offer</b></font><br/>
                                        <font color="#2563eb"><span style={{ fontSize: '10px', color: '#2563eb' }}>Count / Val (%)</span></font>
                                    </td>
                                    <td bgcolor="#dcfce7" align="center" style={{ backgroundColor: '#dcfce7', color: '#166534', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #bbf7d0', fontSize: '12px' }}>
                                        <font color="#166534"><b>PO Received</b></font><br/>
                                        <font color="#15803d"><span style={{ fontSize: '10px', color: '#15803d' }}>Count / Val (%)</span></font>
                                    </td>
                                    <td bgcolor="#ccfbf1" align="center" style={{ backgroundColor: '#ccfbf1', color: '#115e59', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #99f6e4', fontSize: '12px' }}>
                                        <font color="#115e59"><b>Partial PO</b></font><br/>
                                        <font color="#0f766e"><span style={{ fontSize: '10px', color: '#0f766e' }}>Count / Val (%)</span></font>
                                    </td>
                                    <td bgcolor="#e0e7ff" align="center" style={{ backgroundColor: '#e0e7ff', color: '#3730a3', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #c7d2fe', fontSize: '12px' }}>
                                        <font color="#3730a3"><b>Under Review</b></font><br/>
                                        <font color="#4338ca"><span style={{ fontSize: '10px', color: '#4338ca' }}>Count / Val (%)</span></font>
                                    </td>
                                    <td bgcolor="#f3e8ff" align="center" style={{ backgroundColor: '#f3e8ff', color: '#6b21a8', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #e9d5ff', fontSize: '12px' }}>
                                        <font color="#6b21a8"><b>Amendment</b></font><br/>
                                        <font color="#7e22ce"><span style={{ fontSize: '10px', color: '#7e22ce' }}>Count / Val (%)</span></font>
                                    </td>
                                    <td bgcolor="#ffe4e6" align="center" style={{ backgroundColor: '#ffe4e6', color: '#9f1239', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #fecdd3', fontSize: '12px' }}>
                                        <font color="#9f1239"><b>Lost / Expired</b></font><br/>
                                        <font color="#be123c"><span style={{ fontSize: '10px', color: '#be123c' }}>Count / Val (%)</span></font>
                                    </td>
                                </tr>
                            </thead>
                            <tbody>
                                {salesPersonStats.map((sp, idx) => {
                                    const spTotalCount = sp.total.count || 0;
                                    const spTotalVal = sp.total.value || 0;
                                    const spOpenCount = sp['Open']?.count || 0;
                                    const spOpenVal = sp['Open']?.value || 0;
                                    const spPoCount = sp['PO received']?.count || 0;
                                    const spPoVal = sp['PO received']?.value || 0;
                                    const spPartialCount = sp['Partial PO Received']?.count || 0;
                                    const spPartialVal = sp['Partial PO Received']?.value || 0;
                                    const spReviewCount = sp['Under Review']?.count || 0;
                                    const spReviewVal = sp['Under Review']?.value || 0;
                                    const spAmendCount = sp['Need Amendment']?.count || 0;
                                    const spAmendVal = sp['Need Amendment']?.value || 0;
                                    const spLostCount = (sp['Lost']?.count || 0) + (sp['Expired']?.count || 0);
                                    const spLostVal = (sp['Lost']?.value || 0) + (sp['Expired']?.value || 0);

                                    return (
                                        <tr key={sp.id} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                            <td style={{ padding: '8px 10px', fontWeight: 'bold', border: '1px solid #e2e8f0', color: '#0f172a' }}>
                                                {sp.name}
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', border: '1px solid #e2e8f0', backgroundColor: '#f1f5f9', fontWeight: 'bold' }}>
                                                {spTotalCount} <br/><span style={{ color: '#4338ca', fontSize: '11px' }}>{formatCurrencyCompact(spTotalVal)}</span>
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                                                {spOpenCount} <span style={{ fontSize: '10px', color: '#2563eb' }}>({calcPct(spOpenCount, spTotalCount)})</span><br/>
                                                <span style={{ color: '#1d4ed8', fontSize: '11px', fontWeight: 'bold' }}>{formatCurrencyCompact(spOpenVal)}</span> <span style={{ fontSize: '10px', color: '#64748b' }}>({calcPct(spOpenVal, spTotalVal)})</span>
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', border: '1px solid #e2e8f0', backgroundColor: '#f0fdf4' }}>
                                                <strong style={{ color: '#15803d' }}>{spPoCount}</strong> <span style={{ fontSize: '10px', color: '#16a34a' }}>({calcPct(spPoCount, spTotalCount)})</span><br/>
                                                <span style={{ color: '#15803d', fontSize: '11px', fontWeight: 'bold' }}>{formatCurrencyCompact(spPoVal)}</span> <span style={{ fontSize: '10px', color: '#16a34a' }}>({calcPct(spPoVal, spTotalVal)})</span>
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                                                {spPartialCount} <span style={{ fontSize: '10px', color: '#0d9488' }}>({calcPct(spPartialCount, spTotalCount)})</span><br/>
                                                <span style={{ color: '#0f766e', fontSize: '11px' }}>{formatCurrencyCompact(spPartialVal)}</span>
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                                                {spReviewCount} <span style={{ fontSize: '10px', color: '#4f46e5' }}>({calcPct(spReviewCount, spTotalCount)})</span><br/>
                                                <span style={{ color: '#4338ca', fontSize: '11px' }}>{formatCurrencyCompact(spReviewVal)}</span>
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                                                {spAmendCount} <span style={{ fontSize: '10px', color: '#7c3aed' }}>({calcPct(spAmendCount, spTotalCount)})</span><br/>
                                                <span style={{ color: '#7e22ce', fontSize: '11px' }}>{formatCurrencyCompact(spAmendVal)}</span>
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                                                {spLostCount} <span style={{ fontSize: '10px', color: '#e11d48' }}>({calcPct(spLostCount, spTotalCount)})</span><br/>
                                                <span style={{ color: '#be123c', fontSize: '11px' }}>{formatCurrencyCompact(spLostVal)}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr bgcolor="#f8fafc" style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a' }}>
                                    <td bgcolor="#f8fafc" align="left" style={{ backgroundColor: '#f8fafc', color: '#0f172a', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #cbd5e1', fontSize: '12px' }}>
                                        <font color="#0f172a"><b>COMPANY TOTAL</b></font>
                                    </td>
                                    <td bgcolor="#f8fafc" align="center" style={{ backgroundColor: '#f8fafc', color: '#0f172a', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #cbd5e1', fontSize: '12px' }}>
                                        <font color="#0f172a"><b>{totalEnqCount} (100%)<br/>{formatCurrencyCompact(totalEnqVal)}</b></font>
                                    </td>
                                    <td bgcolor="#eff6ff" align="center" style={{ backgroundColor: '#eff6ff', color: '#1e40af', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #cbd5e1', fontSize: '12px' }}>
                                        <font color="#1e40af"><b>{openCount} ({calcPct(openCount, totalEnqCount)})<br/>{formatCurrencyCompact(openVal)} ({calcPct(openVal, totalEnqVal)})</b></font>
                                    </td>
                                    <td bgcolor="#f0fdf4" align="center" style={{ backgroundColor: '#f0fdf4', color: '#166534', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #cbd5e1', fontSize: '12px' }}>
                                        <font color="#166534"><b>{poCount} ({calcPct(poCount, totalEnqCount)})<br/>{formatCurrencyCompact(poVal)} ({calcPct(poVal, totalEnqVal)})</b></font>
                                    </td>
                                    <td bgcolor="#f0fdfa" align="center" style={{ backgroundColor: '#f0fdfa', color: '#115e59', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #cbd5e1', fontSize: '12px' }}>
                                        <font color="#115e59"><b>{partialPoCount} ({calcPct(partialPoCount, totalEnqCount)})<br/>{formatCurrencyCompact(partialPoVal)}</b></font>
                                    </td>
                                    <td bgcolor="#eef2ff" align="center" style={{ backgroundColor: '#eef2ff', color: '#3730a3', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #cbd5e1', fontSize: '12px' }}>
                                        <font color="#3730a3"><b>{underReviewCount} ({calcPct(underReviewCount, totalEnqCount)})<br/>{formatCurrencyCompact(underReviewVal)}</b></font>
                                    </td>
                                    <td bgcolor="#faf5ff" align="center" style={{ backgroundColor: '#faf5ff', color: '#6b21a8', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #cbd5e1', fontSize: '12px' }}>
                                        <font color="#6b21a8"><b>{amendCount} ({calcPct(amendCount, totalEnqCount)})<br/>{formatCurrencyCompact(amendVal)}</b></font>
                                    </td>
                                    <td bgcolor="#fff1f2" align="center" style={{ backgroundColor: '#fff1f2', color: '#9f1239', fontWeight: 'bold', padding: '10px 8px', border: '1px solid #cbd5e1', fontSize: '12px' }}>
                                        <font color="#9f1239"><b>{lostCount} ({calcPct(lostCount, totalEnqCount)})<br/>{formatCurrencyCompact(lostVal)}</b></font>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>

                        {/* SECTION 2: TOP 10 HIGH VALUE OFFERS (LATEST 1 MONTH - LIGHTER HEADER) */}
                        <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            2. Top 10 High-Value Offers (Latest 1 Month - With 1-Click App Links)
                        </h3>

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #cbd5e1', marginBottom: '24px' }}>
                            <thead>
                                <tr bgcolor="#f1f5f9" style={{ backgroundColor: '#f1f5f9' }}>
                                    <td bgcolor="#f1f5f9" align="center" style={{ backgroundColor: '#f1f5f9', color: '#0f172a', fontWeight: 'bold', padding: '9px 8px', border: '1px solid #cbd5e1', fontSize: '12px', width: '30px' }}>
                                        <font color="#0f172a"><b>#</b></font>
                                    </td>
                                    <td bgcolor="#f1f5f9" align="left" style={{ backgroundColor: '#f1f5f9', color: '#0f172a', fontWeight: 'bold', padding: '9px 8px', border: '1px solid #cbd5e1', fontSize: '12px' }}>
                                        <font color="#0f172a"><b>Quotation Ref</b></font>
                                    </td>
                                    <td bgcolor="#f1f5f9" align="left" style={{ backgroundColor: '#f1f5f9', color: '#0f172a', fontWeight: 'bold', padding: '9px 8px', border: '1px solid #cbd5e1', fontSize: '12px' }}>
                                        <font color="#0f172a"><b>Customer Name</b></font>
                                    </td>
                                    <td bgcolor="#f1f5f9" align="left" style={{ backgroundColor: '#f1f5f9', color: '#0f172a', fontWeight: 'bold', padding: '9px 8px', border: '1px solid #cbd5e1', fontSize: '12px' }}>
                                        <font color="#0f172a"><b>Sales Person</b></font>
                                    </td>
                                    <td bgcolor="#f1f5f9" align="right" style={{ backgroundColor: '#f1f5f9', color: '#0f172a', fontWeight: 'bold', padding: '9px 8px', border: '1px solid #cbd5e1', fontSize: '12px' }}>
                                        <font color="#0f172a"><b>Offer Value (INR)</b></font>
                                    </td>
                                    <td bgcolor="#f1f5f9" align="center" style={{ backgroundColor: '#f1f5f9', color: '#0f172a', fontWeight: 'bold', padding: '9px 8px', border: '1px solid #cbd5e1', fontSize: '12px' }}>
                                        <font color="#0f172a"><b>Status</b></font>
                                    </td>
                                    <td bgcolor="#f1f5f9" align="center" style={{ backgroundColor: '#f1f5f9', color: '#0f172a', fontWeight: 'bold', padding: '9px 8px', border: '1px solid #cbd5e1', fontSize: '12px' }}>
                                        <font color="#0f172a"><b>Date</b></font>
                                    </td>
                                    <td bgcolor="#f1f5f9" align="center" style={{ backgroundColor: '#f1f5f9', color: '#0f172a', fontWeight: 'bold', padding: '9px 8px', border: '1px solid #cbd5e1', fontSize: '12px' }}>
                                        <font color="#0f172a"><b>App Link</b></font>
                                    </td>
                                </tr>
                            </thead>
                            <tbody>
                                {top10Offers.map((offer, idx) => (
                                    <tr key={offer.id} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                        <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #e2e8f0', color: '#64748b' }}>
                                            {offer.rank}
                                        </td>
                                        <td style={{ padding: '8px 10px', fontWeight: 'bold', border: '1px solid #e2e8f0', color: '#4338ca' }}>
                                            {offer.quotationNumber}
                                        </td>
                                        <td style={{ padding: '8px 10px', fontWeight: 'bold', border: '1px solid #e2e8f0', color: '#1e293b' }}>
                                            {offer.customerName}
                                        </td>
                                        <td style={{ padding: '8px 10px', border: '1px solid #e2e8f0', color: '#334155' }}>
                                            {offer.salesPerson}
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', border: '1px solid #e2e8f0', color: '#0f172a' }}>
                                            {formatCurrency(offer.amount)}
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'center', border: '1px solid #e2e8f0', fontWeight: 'bold', color: offer.status === 'PO received' ? '#15803d' : offer.status === 'Open' ? '#1d4ed8' : '#b45309' }}>
                                            {offer.status}
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'center', border: '1px solid #e2e8f0', color: '#64748b' }}>
                                            {offer.date}
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                                            <a
                                                href={offer.appLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ color: '#4338ca', fontWeight: 'bold', textDecoration: 'underline', backgroundColor: '#e0e7ff', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', display: 'inline-block' }}
                                            >
                                                Open Offer ↗
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* 3. SIGNATURE - EXACT MATCH TO IMAGE 2 (WITH EMBEDDED SIDDHI LOGO & CONTACT DETAILS) */}
                        <table cellPadding="0" cellSpacing="0" border={0} style={{ marginTop: '24px', paddingTop: '16px', borderTop: '2px solid #e2e8f0', fontFamily: 'Segoe UI, Helvetica, Arial, sans-serif' }}>
                            <tbody>
                                <tr>
                                    <td valign="top" style={{ paddingRight: '16px', width: '95px' }}>
                                        <img
                                            src={SIDDHI_LOGO_BASE64}
                                            width="90"
                                            height="90"
                                            alt="Siddhi"
                                            style={{ display: 'block', border: '0', width: '90px', height: 'auto' }}
                                        />
                                    </td>
                                    <td valign="top" style={{ fontSize: '13px', color: '#0f172a', lineHeight: '1.45' }}>
                                        <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a' }}>Kumar N</div>
                                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', marginTop: '2px' }}>Sales Co-Ordinator</div>
                                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', marginTop: '2px', marginBottom: '6px' }}>Siddhi Kabel Corporation Pvt Ltd</div>
                                        <div style={{ fontSize: '12px', color: '#1e293b', marginTop: '3px' }}>
                                            <span style={{ fontSize: '14px' }}>✉</span>&nbsp;<a href="mailto:sales@siddhikabel.com" style={{ color: '#2563eb', textDecoration: 'underline', fontWeight: 500 }}>sales@siddhikabel.com</a>
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#1e293b', marginTop: '3px' }}>
                                            <span style={{ color: '#e11d48', fontSize: '14px' }}>📞</span>&nbsp;9620000947 / 9886058511
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#1e293b', marginTop: '3px' }}>
                                            <span style={{ color: '#e11d48', fontSize: '14px' }}>📍</span>&nbsp;#3, 1st Main, 1st Block, BSK 3rd Stage, Bangalore – 560 085
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#1e293b', marginTop: '3px' }}>
                                            <span style={{ color: '#0284c7', fontSize: '14px' }}>🌐</span>&nbsp;<a href="http://www.siddhikabel.com" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline', fontWeight: 500 }}>www.siddhikabel.com</a>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-3 sm:p-4 bg-white border-t border-slate-200 flex justify-between items-center shrink-0">
                    <div className="text-xs text-slate-500 font-medium hidden sm:block">
                        Tip: Click <strong>"Copy Rich Email"</strong> to paste directly into Microsoft Outlook or Gmail compose window.
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
                        >
                            Close
                        </button>
                        <button
                            type="button"
                            onClick={handleCopyHtml}
                            className={`px-4 py-2 text-xs font-bold text-white rounded-xl transition-all shadow-xs flex items-center gap-1.5 ${
                                copiedHtml ? 'bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                        >
                            {copiedHtml ? '✓ Rich Email Copied!' : 'Copy Email Report'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
