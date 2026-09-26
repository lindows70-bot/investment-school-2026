// 오늘의 명언 51개 상수 — docs/student-mode/quotes.md 원문 확인 목록에서 scripts/generate-quotes.mjs 로 그대로 옮김(손으로 옮기지 않음)
export interface Quote {
  id: string
  person: string
  ko: string
  original: string
  source: string
  /** 화면 표시용 — source 에서 마크다운 강조 기호와 "(화면에 ... 표기)" 같은 편집 지시 괄호를 뺀 문구 */
  sourceLabel: string
  /** B22 처럼 person 이 실제로 한 말을 다른 사람이 인용한 경우, 인용한 사람 */
  quotedBy?: string
  /** 표 각 행 출처엔 없고 소제목에만 있는 맥락(예: 템플턴 "16 Rules for Investment Success (1993)") */
  note?: string
}

export const QUOTES: Quote[] = [
  { id: "B01", person: "워런 버핏", ko: "다른 사람들이 탐욕스러울 때 두려워하고, 다른 사람들이 두려워할 때만 탐욕스러워지려 합니다.", original: "we simply attempt to be fearful when others are greedy and to be greedy only when others are fearful.", source: "1986 주주서한", sourceLabel: "1986 주주서한" },
  { id: "B02", person: "워런 버핏", ko: "양말이든 주식이든, 저는 좋은 물건을 할인할 때 사는 걸 좋아합니다.", original: "Whether we're talking about socks or stocks, I like buying quality merchandise when it is marked down.", source: "2008 주주서한", sourceLabel: "2008 주주서한" },
  { id: "B03", person: "워런 버핏", ko: "뛰어난 경영진이 이끄는 뛰어난 기업을 가졌다면, 우리가 가장 좋아하는 보유 기간은 '영원히'입니다.", original: "In fact, when we own portions of outstanding businesses with outstanding managements, our favorite holding period is forever.", source: "1988 주주서한", sourceLabel: "1988 주주서한" },
  { id: "B04", person: "워런 버핏", ko: "10년 동안 가질 생각이 없는 주식이라면 10분도 갖지 마세요.", original: "If you aren't willing to own a stock for ten years, don't even think about owning it for ten minutes.", source: "1996 주주서한", sourceLabel: "1996 주주서한" },
  { id: "B05", person: "워런 버핏", ko: "평범한 기업을 훌륭한 가격에 사는 것보다, 훌륭한 기업을 적당한 가격에 사는 편이 훨씬 낫습니다.", original: "It's far better to buy a wonderful company at a fair price than a fair company at a wonderful price.", source: "1989 주주서한", sourceLabel: "1989 주주서한" },
  { id: "B06", person: "워런 버핏", ko: "시간은 훌륭한 기업의 친구이고, 평범한 기업의 적입니다.", original: "Time is the friend of the wonderful business, the enemy of the mediocre.", source: "1989 주주서한", sourceLabel: "1989 주주서한" },
  { id: "B07", person: "워런 버핏", ko: "자기가 잘 아는 범위 안의 기업만 평가할 수 있으면 됩니다. 그 범위의 넓이는 중요하지 않지만, 경계를 아는 것은 꼭 필요합니다.", original: "You only have to be able to evaluate companies within your circle of competence. The size of that circle is not very important; knowing its boundaries, however, is vital.", source: "1996 주주서한", sourceLabel: "1996 주주서한" },
  { id: "B08", person: "워런 버핏", ko: "기관이든 개인이든 대부분의 투자자에게는 보수가 아주 낮은 인덱스펀드가 주식을 갖는 가장 좋은 방법입니다.", original: "Most investors, both institutional and individual, will find that the best way to own common stocks is through an index fund that charges minimal fees.", source: "1996 주주서한", sourceLabel: "1996 주주서한" },
  { id: "B09", person: "워런 버핏", ko: "투자자는 흥분과 비용이 자신의 적이라는 걸 기억해야 합니다.", original: "Investors should remember that excitement and expenses are their enemies.", source: "2004 주주서한", sourceLabel: "2004 주주서한" },
  { id: "B10", person: "워런 버핏", ko: "예측은 예측하는 사람에 대해서는 많은 걸 알려주지만, 미래에 대해서는 아무것도 알려주지 않습니다.", original: "The forecasts may tell you a great deal about the forecaster; they tell you nothing about the future.", source: "1980 주주서한", sourceLabel: "1980 주주서한" },
  { id: "B11", person: "워런 버핏", ko: "누가 벌거벗고 수영하고 있었는지는 썰물이 되어야 알 수 있습니다.", original: "After all, you only find out who is swimming naked when the tide goes out.", source: "2001 주주서한", sourceLabel: "2001 주주서한" },
  { id: "B12", person: "워런 버핏", ko: "계속 물이 새는 배에 타고 있다면, 구멍을 막는 데보다 배를 바꾸는 데 힘을 쓰는 편이 낫습니다.", original: "Should you find yourself in a chronically-leaking boat, energy devoted to changing vessels is likely to be more productive than energy devoted to patching leaks.", source: "1985 주주서한", sourceLabel: "1985 주주서한" },
  { id: "B13", person: "워런 버핏", ko: "정말 훌륭한 기업을 찾았다면 계속 함께하세요. 인내는 보답하고, 훌륭한 기업 하나가 피할 수 없는 수많은 평범한 결정을 메워 줍니다.", original: "When you find a truly wonderful business, stick with it. Patience pays, and one wonderful business can offset the many mediocre decisions that are inevitable.", source: "2023 주주서한", sourceLabel: "2023 주주서한" },
  { id: "B14", person: "워런 버핏", ko: "오늘날 학생들은 케인스가 '새롭다'고 했던 것을 배웁니다. 저축에 복리를 더하면 놀라운 일이 일어난다는 것을요.", original: "Today, school children learn what Keynes termed \"novel\": combining savings with compound interest works wonders.", source: "2019 주주서한", sourceLabel: "2019 주주서한" },
  { id: "B15", person: "워런 버핏", ko: "투자에서는 비관이 친구이고, 도취가 적입니다.", original: "When investing, pessimism is your friend, euphoria the enemy.", source: "2008 주주서한", sourceLabel: "2008 주주서한" },
  { id: "B16", person: "워런 버핏", ko: "미스터 마켓은 여러분을 도우려고 있는 것이지, 이끌려고 있는 것이 아닙니다.", original: "Mr. Market is there to serve you, not to guide you.", source: "1987 주주서한", sourceLabel: "1987 주주서한" },
  { id: "B17", person: "워런 버핏", ko: "거시 경제를 전망하거나 남의 시장 예측을 듣는 것은 시간 낭비입니다.", original: "Forming macro opinions or listening to the macro or market predictions of others is a waste of time.", source: "2013 주주서한", sourceLabel: "2013 주주서한" },
  { id: "B18", person: "워런 버핏", ko: "시장 예측가는 여러분의 귀는 채워 주겠지만 지갑은 절대 채워 주지 않습니다.", original: "Market forecasters will fill your ear but will never fill your wallet.", source: "2014 주주서한", sourceLabel: "2014 주주서한" },
  { id: "B19", person: "워런 버핏", ko: "큰 투자자든 작은 투자자든 비용이 낮은 인덱스펀드를 꾸준히 가져가야 합니다.", original: "Both large and small investors should stick with low-cost index funds.", source: "2016 주주서한", sourceLabel: "2016 주주서한" },
  { id: "B20", person: "워런 버핏", ko: "크고 '쉬운' 결정을 붙잡고, 잦은 매매는 피하세요.", original: "A final lesson from our bet: Stick with big, \"easy\" decisions and eschew activity.", source: "2017 주주서한", sourceLabel: "2017 주주서한" },
  { id: "B21", person: "워런 버핏", ko: "영구적인 원금 손실의 위험은 절대 지지 마세요.", original: "Never risk permanent loss of capital.", source: "2023 주주서한", sourceLabel: "2023 주주서한" },
  { id: "B22", person: "벤저민 그레이엄", ko: "오래전 벤 그레이엄이 가르쳐 주었습니다. \"가격은 여러분이 내는 것이고, 가치는 여러분이 얻는 것입니다.\"", original: "Long ago, Ben Graham taught me that \"Price is what you pay; value is what you get.\"", source: "2008 주주서한 — **그레이엄의 말을 버핏이 인용** (화면에 그렇게 표기)", sourceLabel: "2008 주주서한 — 그레이엄의 말을 버핏이 인용", quotedBy: "워런 버핏" },
  { id: "L01", person: "피터 린치", ko: "공부 없이 투자하는 것은 카드를 보지 않고 포커를 치는 것과 같습니다.", original: "Investing without research is like playing stud poker and never looking at the cards.", source: "『전설로 떠나는 월가의 영웅(One Up on Wall Street)』 1989", sourceLabel: "『전설로 떠나는 월가의 영웅(One Up on Wall Street)』 1989" },
  { id: "L02", person: "피터 린치", ko: "기본 사업을 이해하면 회사 이야기를 알기가 훨씬 쉽습니다. 그래서 저는 통신위성보다 스타킹에, 광섬유보다 모텔 체인에 투자하겠습니다.", original: "Getting the story on a company is a lot easier if you understand the basic business. That's why I'd rather invest in panty hose than in communications satellites, or in motel chains than in fiber optics.", source: "『One Up on Wall Street』 1989", sourceLabel: "『One Up on Wall Street』 1989" },
  { id: "L03", person: "피터 린치", ko: "크레용으로 그려서 설명할 수 없는 아이디어에는 절대 투자하지 마세요.", original: "Never invest in any idea you can't illustrate with a crayon.", source: "『피터 린치의 이기는 투자(Beating the Street)』 1993", sourceLabel: "『피터 린치의 이기는 투자(Beating the Street)』 1993" },
  { id: "L04", person: "피터 린치", ko: "모든 주식 뒤에는 회사가 있습니다. 그 회사가 무엇을 하는지 알아내세요.", original: "Behind every stock is a company. Find out what it's doing.", source: "『Beating the Street』 — 20가지 황금 원칙", sourceLabel: "『Beating the Street』 — 20가지 황금 원칙" },
  { id: "L05", person: "피터 린치", ko: "무엇을 가졌는지, 그리고 왜 가졌는지 알아야 합니다.", original: "You have to know what you own, and why you own it.", source: "『Beating the Street』 — 20가지 황금 원칙", sourceLabel: "『Beating the Street』 — 20가지 황금 원칙" },
  { id: "L06", person: "피터 린치", ko: "주식을 갖는 것은 아이를 키우는 것과 같습니다. 감당할 수 있는 것보다 많이 떠맡지 마세요.", original: "Owning stocks is like having children—don't get involved with more than you can handle.", source: "『Beating the Street』 — 20가지 황금 원칙", sourceLabel: "『Beating the Street』 — 20가지 황금 원칙" },
  { id: "L07", person: "피터 린치", ko: "주식으로 돈을 버는 열쇠는 겁에 질려 주식에서 도망치지 않는 것입니다.", original: "The key to making money in stocks is not to get scared out of them.", source: "『Beating the Street』 1993", sourceLabel: "『Beating the Street』 1993" },
  { id: "L08", person: "피터 린치", ko: "오래도록 잘되는 주식은 오래도록 잘되는 회사의 주식입니다. 성공 투자의 열쇠는 성공하는 회사를 찾는 것입니다.", original: "Stocks that do well in the long run belong to companies that do well in the long run. The key to successful investing is finding successful companies.", source: "『Learn to Earn』 1995", sourceLabel: "『Learn to Earn』 1995" },
  { id: "G01", person: "벤저민 그레이엄", ko: "건전한 투자의 비밀을 세 단어로 줄이라면, 우리는 이 말을 내놓겠습니다. 안전마진.", original: "Confronted with a like challenge to distill the secret of sound investment into three words, we venture the motto, MARGIN OF SAFETY.", source: "『현명한 투자자』 1959년판", sourceLabel: "『현명한 투자자』 1959년판" },
  { id: "G02", person: "벤저민 그레이엄", ko: "투자는 가장 사업처럼 할 때 가장 현명합니다.", original: "Investment is most intelligent when it is most businesslike.", source: "『현명한 투자자』 1959년판", sourceLabel: "『현명한 투자자』 1959년판" },
  { id: "G03", person: "벤저민 그레이엄", ko: "진정한 투자자에게 가격 변동의 의미는 하나뿐입니다. 크게 떨어지면 현명하게 살 기회, 크게 오르면 현명하게 팔 기회입니다.", original: "Basically, price fluctuations have only one significant meaning for the true investor. They provide him with an opportunity to buy wisely when prices fall sharply and to sell wisely when they advance a great deal.", source: "『현명한 투자자』 1959년판", sourceLabel: "『현명한 투자자』 1959년판" },
  { id: "G04", person: "벤저민 그레이엄", ko: "주식시장은 저울이 아니라 투표 기계입니다.", original: "The stock market is a voting machine rather than a weighing machine.", source: "『증권분석』 1934년판", sourceLabel: "『증권분석』 1934년판" },
  { id: "F01", person: "필립 피셔", ko: "주식을 살 때 공부를 제대로 했다면, 팔아야 할 때는 거의 없습니다.", original: "If the job has been correctly done when a common stock is purchased, the time to sell it is—almost never.", source: "『위대한 기업에 투자하라』 1958", sourceLabel: "『위대한 기업에 투자하라』 1958" },
  { id: "F02", person: "필립 피셔", ko: "지금 모두가 하는 일, 그래서 나도 참기 힘들 만큼 하고 싶은 일이 사실은 완전히 틀린 일인 경우가 많습니다.", original: "Doing what everybody else is doing at the moment, and therefore what you have an almost irresistible urge to do, is often the wrong thing to do at all.", source: "『위대한 기업에 투자하라』 1958", sourceLabel: "『위대한 기업에 투자하라』 1958" },
  { id: "T01", person: "존 템플턴", ko: "실수를 피하는 유일한 방법은 투자하지 않는 것입니다. 그런데 그게 가장 큰 실수입니다.", original: "The only way to avoid mistakes is not to invest—which is the biggest mistake of all.", source: "16가지 원칙 중 11번", sourceLabel: "16가지 원칙 중 11번", note: "16 Rules for Investment Success (1993)" },
  { id: "T02", person: "존 템플턴", ko: "영원한 강세장은 없습니다. 영원한 약세장도 없습니다.", original: "No bull market is permanent. No bear market is permanent.", source: "16가지 원칙 중 9번", sourceLabel: "16가지 원칙 중 9번", note: "16 Rules for Investment Success (1993)" },
  { id: "T03", person: "존 템플턴", ko: "모든 답을 안다는 투자자는 질문조차 다 이해하지 못한 것입니다.", original: "An investor who has all the answers doesn't even understand all the questions.", source: "16가지 원칙 중 14번", sourceLabel: "16가지 원칙 중 14번", note: "16 Rules for Investment Success (1993)" },
  { id: "T04", person: "존 템플턴", ko: "사실은 예전의 반복인데도 '이번엔 다르다'고 말하는 투자자는, 투자 역사에서 가장 값비싼 말을 한 것입니다.", original: "The investor who says, \"This time is different,\" when in fact it's virtually a repeat of an earlier situation, has uttered among the four most costly words in the annals of investing.", source: "16가지 원칙 중 11번", sourceLabel: "16가지 원칙 중 11번", note: "16 Rules for Investment Success (1993)" },
  { id: "T05", person: "존 템플턴", ko: "분산하세요. 주식과 채권에서도, 다른 많은 일에서처럼, 여럿일 때 안전합니다.", original: "Diversify. In stocks and bonds, as in much else, there is safety in numbers.", source: "16가지 원칙 중 8번", sourceLabel: "16가지 원칙 중 8번", note: "16 Rules for Investment Success (1993)" },
  { id: "M01", person: "하워드 막스", ko: "세상에서 가장 위험한 것은 위험이 없다는 믿음이 널리 퍼지는 것입니다.", original: "The riskiest thing in the world is the widespread belief that there's no risk.", source: "메모 \"Risk Revisited\" 2014", sourceLabel: "메모 \"Risk Revisited\" 2014" },
  { id: "M02", person: "하워드 막스", ko: "어디로 가는지는 알 수 없어도, 사이클에서 지금 어디쯤 있는지는 알아야 합니다.", original: "…while we can't know where we're going, we ought to know where we are (in cyclical terms).", source: "메모 \"It's All Good\" 2007", sourceLabel: "메모 \"It's All Good\" 2007" },
  { id: "M03", person: "하워드 막스", ko: "대부분의 것은 결국 사이클을 그리고, 극단에서 평균 쪽으로 되돌아오는 경향이 있습니다.", original: "…most things eventually prove to be cyclical and tend to swing back from the extreme toward the mean.", source: "메모 \"Taking the Temperature\" 2023", sourceLabel: "메모 \"Taking the Temperature\" 2023" },
  { id: "C01", person: "찰리 멍거", ko: "아침에 일어났을 때보다 조금 더 현명해지려고 애쓰며 하루를 보내세요.", original: "Spend each day trying to be a little wiser than you were when you woke up.", source: "『가난한 찰리의 연감(Poor Charlie's Almanack)』", sourceLabel: "『가난한 찰리의 연감(Poor Charlie's Almanack)』" },
  { id: "C02", person: "찰리 멍거", ko: "가장 똑똑하지도, 때로는 가장 부지런하지도 않은 사람들이 성공하는 걸 늘 봅니다. 그들은 배우는 기계입니다.", original: "I constantly see people rise in life who are not the smartest, sometimes not even the most diligent. But they are learning machines.", source: "USC 로스쿨 졸업식 연설 2007", sourceLabel: "USC 로스쿨 졸업식 연설 2007" },
  { id: "J01", person: "존 보글", ko: "성과는 왔다가 가지만, 비용은 영원히 굴러갑니다.", original: "Performance comes and goes, but costs roll on forever.", source: "강연 \"In Investing, You Get What You Don't Pay For\" 2005", sourceLabel: "강연 \"In Investing, You Get What You Don't Pay For\" 2005" },
  { id: "J02", person: "존 보글", ko: "투자에서는 내지 않은 만큼 얻습니다.", original: "You get what you don't pay for.", source: "같은 강연 2005", sourceLabel: "같은 강연 2005" },
  { id: "J03", person: "존 보글", ko: "시간은 여러분의 친구이고, 충동은 여러분의 적입니다.", original: "Time Is Your Friend, Impulse Is Your Enemy", source: "『The Clash of the Cultures』 2012, 9장 원칙 2 제목", sourceLabel: "『The Clash of the Cultures』 2012, 9장 원칙 2 제목" },
  { id: "J04", person: "존 보글", ko: "건초더미에서 바늘 찾기가 얼마나 어려운지 안다면, 그냥 건초더미를 사세요.", original: "When you understand how hard it is to find that needle, simply buy the haystack.", source: "『The Clash of the Cultures』 2012, 9장 원칙 5", sourceLabel: "『The Clash of the Cultures』 2012, 9장 원칙 5" },
  { id: "J05", person: "존 보글", ko: "투자의 비밀은 비밀이 없다는 것입니다.", original: "The secret to investing is that there is no secret.", source: "『The Clash of the Cultures』 2012, 9장 원칙 10", sourceLabel: "『The Clash of the Cultures』 2012, 9장 원칙 10" },
]

const EPOCH_UTC = Date.UTC(2026, 0, 1) // 2026-01-01 고정 기준일 — 이 값을 바꾸면 기존에 나간 날짜별 명언이 전부 바뀐다
const DAY_MS = 24 * 60 * 60 * 1000

/** todayKst 는 'YYYY-MM-DD' 형식의 KST 날짜 문자열. Date.now() 를 쓰지 않는 순수 함수 — 기준일부터 며칠째인지를 51로 나눈 나머지로 순환한다 */
export function quoteOfDay(todayKst: string): Quote {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(todayKst)
  if (!m) throw new Error(`quoteOfDay: 잘못된 날짜 형식 "${todayKst}" (YYYY-MM-DD 필요)`)
  const [, y, mo, d] = m
  const ts = Date.UTC(Number(y), Number(mo) - 1, Number(d))
  const days = Math.floor((ts - EPOCH_UTC) / DAY_MS)
  const idx = ((days % QUOTES.length) + QUOTES.length) % QUOTES.length
  return QUOTES[idx]
}
