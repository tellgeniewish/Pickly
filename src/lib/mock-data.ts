import vote1 from "@/assets/vote-1.jpg";
import vote2 from "@/assets/vote-2.jpg";
import vote3 from "@/assets/vote-3.jpg";
import vote4 from "@/assets/vote-4.jpg";
import seoulforest from "@/assets/spot-seoulforest.jpg";
import hangang from "@/assets/spot-hangang.jpg";
import gyeongbok from "@/assets/spot-gyeongbok.jpg";

export const photoSpots = [
  {
    rank: 1,
    name: "성수동 서울숲",
    recommend: 89,
    tags: ["감성", "자연광", "데이트"],
    image: seoulforest,
  },
  {
    rank: 2,
    name: "한강공원",
    recommend: 76,
    tags: ["노을", "야경", "산책"],
    image: hangang,
  },
  {
    rank: 3,
    name: "경복궁",
    recommend: 68,
    tags: ["전통", "여행", "한복"],
    image: gyeongbok,
  },
];

export const stats = {
  totalParticipants: 1234,
  votesToday: 83,
};

export const sampleVote = {
  id: "demo",
  title: "이번 주말 인스타 업로드용 ✨",
  location: "📍 서울숲",
  participants: 37,
  deadline: "3일",
  photos: [
    { id: "p1", url: vote1, recommend: 92 },
    { id: "p2", url: vote2, recommend: 77 },
    { id: "p3", url: vote3, recommend: 65 },
    { id: "p4", url: vote4, recommend: 51 },
  ],
};

export const myVotes = {
  active: [
    { id: "demo", title: "이번 주말 인스타 업로드용 ✨", participants: 37, deadline: "D-2" },
    { id: "v2", title: "프로필 사진 골라줘", participants: 12, deadline: "D-5" },
  ],
  ended: [
    { id: "v3", title: "여행 베스트컷 (제주도)", participants: 84, deadline: "종료" },
    { id: "v4", title: "유튜브 썸네일 A/B", participants: 56, deadline: "종료" },
    { id: "v5", title: "회사 홍보 이미지", participants: 41, deadline: "종료" },
    { id: "v6", title: "카톡 프로필 후보", participants: 28, deadline: "종료" },
  ],
};

export const aiInsight = {
  summary:
    "친구들은 자연광이 잘 드러나고 표정이 자연스러운 사진에 높은 선호를 보였습니다. 1위 사진은 부드러운 골든아워 조명과 진솔한 미소가 강점이며, 배경의 여백이 시선을 인물에 집중시킵니다.",
  spaceKeywords: ["감성", "데이트", "자연광", "골든아워"],
  topAnalysis: [
    {
      rank: 1,
      구도: "정중앙 + 안정적인 시선 처리",
      표정: "자연스러운 미소",
      색감: "따뜻한 골든톤",
      배경: "여백이 넉넉한 정원",
      조명: "부드러운 역광",
    },
    {
      rank: 2,
      구도: "측면 3/4 컷",
      표정: "시크한 무표정",
      색감: "차분한 베이지",
      배경: "도시 골목",
      조명: "강한 사이드 라이트",
    },
    {
      rank: 3,
      구도: "전신 클로즈업",
      표정: "환한 웃음",
      색감: "그린 톤 자연광",
      배경: "공원 나무 사이",
      조명: "맑은 자연광",
    },
  ],
};
