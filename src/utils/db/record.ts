import { getUTCUnixTimestamp } from '../index'
import type { Word } from '@/typings'

export interface IWordRecord {
  word: string
  timeStamp: number
  // 正常章节为 dictKey, 其他功能则为对应的类型
  dict: string
  // 用户可能是在 错题/其他类似组件中 进行的练习则为 null, start from 0
  chapter: number | null
  // 正确次数中输入每个字母的时间差，可以据此计算出总时间
  timing: number[]
  // 出错的次数
  wrongCount: number
  // 每个字母被错误输入成什么, index 为字母的索引, 数组内为错误的 e.key
  mistakes: LetterMistakes
}

export interface LetterMistakes {
  // 每个字母被错误输入成什么, index 为字母的索引, 数组内为错误的 e.key
  [index: number]: string[]
}

export class WordRecord implements IWordRecord {
  word: string
  timeStamp: number
  dict: string
  chapter: number | null
  timing: number[]
  wrongCount: number
  mistakes: LetterMistakes

  constructor(word: string, dict: string, chapter: number | null, timing: number[], wrongCount: number, mistakes: LetterMistakes) {
    this.word = word
    this.timeStamp = getUTCUnixTimestamp()
    this.dict = dict
    this.chapter = chapter
    this.timing = timing
    this.wrongCount = wrongCount
    this.mistakes = mistakes
  }

  get totalTime() {
    return this.timing.reduce((acc, curr) => acc + curr, 0)
  }
}

export interface IChapterRecord {
  // 正常章节为 dictKey, 其他功能则为对应的类型
  dict: string
  // 在错题场景中为 -1
  chapter: number | null
  timeStamp: number
  // 单位为 s，章节的记录没必要到毫秒级
  time: number
  // 正确按键次数，输对一个字母即记录
  correctCount: number
  // 错误的按键次数。 出错会清空整个输入，但只记录一次错误
  wrongCount: number
  // 用户输入的单词总数，可能会使用循环等功能使输入总数大于 20
  wordCount: number
  // 一次打对未犯错的单词列表, 可以和 wordNumber 对比得出出错的单词 indexes
  correctWordIndexes: number[]
  // 章节总单词数
  wordNumber: number
  // 单词 record 的 id 列表
  wordRecordIds: number[]
}

export class ChapterRecord implements IChapterRecord {
  dict: string
  chapter: number | null
  timeStamp: number
  time: number
  correctCount: number
  wrongCount: number
  wordCount: number
  correctWordIndexes: number[]
  wordNumber: number
  wordRecordIds: number[]

  constructor(
    dict: string,
    chapter: number | null,
    time: number,
    correctCount: number,
    wrongCount: number,
    wordCount: number,
    correctWordIndexes: number[],
    wordNumber: number,
    wordRecordIds: number[],
  ) {
    this.dict = dict
    this.chapter = chapter
    this.timeStamp = getUTCUnixTimestamp()
    this.time = time
    this.correctCount = correctCount
    this.wrongCount = wrongCount
    this.wordCount = wordCount
    this.correctWordIndexes = correctWordIndexes
    this.wordNumber = wordNumber
    this.wordRecordIds = wordRecordIds
  }

  get wpm() {
    return Math.round((this.wordCount / this.time) * 60)
  }

  get inputAccuracy() {
    return Math.round((this.correctCount / this.correctCount + this.wrongCount) * 100)
  }

  get wordAccuracy() {
    return Math.round((this.correctWordIndexes.length / this.wordNumber) * 100)
  }
}

export interface IReviewRecord {
  id?: number
  dict: string
  // 当前练习进度
  index: number
  // 创建时间
  createTime: number
  // 是否已经完成
  isFinished: boolean
  // 单词列表, 根据复习算法生成和修改，可能会有重复值
  words: Word[]
}

export class ReviewRecord implements IReviewRecord {
  id?: number
  dict: string
  index: number
  createTime: number
  isFinished: boolean
  words: Word[]

  constructor(dict: string, words: Word[]) {
    this.dict = dict
    this.index = 0
    this.createTime = getUTCUnixTimestamp()
    this.words = words
    this.isFinished = false
  }
}

export interface IRevisionDictRecord {
  dict: string
  revisionIndex: number
  createdTime: number
}

export class RevisionDictRecord implements IRevisionDictRecord {
  dict: string
  revisionIndex: number
  createdTime: number

  constructor(dict: string, revisionIndex: number, createdTime: number) {
    this.dict = dict
    this.revisionIndex = revisionIndex
    this.createdTime = createdTime
  }
}

export interface IRevisionWordRecord {
  word: string
  timeStamp: number
  dict: string
  errorCount: number
}

export class RevisionWordRecord implements IRevisionWordRecord {
  word: string
  timeStamp: number
  dict: string
  errorCount: number

  constructor(word: string, dict: string, errorCount: number) {
    this.word = word
    this.timeStamp = getUTCUnixTimestamp()
    this.dict = dict
    this.errorCount = errorCount
  }
}

/**
 * 游戏单局成绩（spec-20261019-v1 / 01 REQ-06）。
 * 纯本地存储（gameRecords 表），零上传、无服务端排行榜。
 * `track` 两轨分开记录、分开标注，不混算（01 REQ-04 口径纪律）。
 */
export interface IGameRecord {
  id?: number
  gameId: 'moyu' | 'shoot' | 'idiom'
  track: 'code' | 'ime'
  language: 'zh' | 'en'
  tier: 'intro' | 'mid' | 'adv'
  mode: 'practice' | 'challenge'
  score: number
  /** 字准确率 0~1 */
  accuracy: number
  /** 击键/秒 */
  kps: number
  maxCombo: number
  rating: 'S' | 'A' | 'B' | 'C' | 'D' | 'F'
  /** 时长（秒） */
  time: number
  timestamp: number
  /** 幽灵数据（逐目标时间戳 ms，相对开局）；本批次只存不展示 */
  ghost?: number[]
  /** 墨雨完成笔画数 */
  strokes?: number
  /** 诗词射击通关篇目数 */
  poemsCleared?: number
  /** 成语接龙接龙长度 */
  chainLength?: number
}

export class GameRecord implements IGameRecord {
  id?: number
  gameId: 'moyu' | 'shoot' | 'idiom'
  track: 'code' | 'ime'
  language: 'zh' | 'en'
  tier: 'intro' | 'mid' | 'adv'
  mode: 'practice' | 'challenge'
  score: number
  accuracy: number
  kps: number
  maxCombo: number
  rating: 'S' | 'A' | 'B' | 'C' | 'D' | 'F'
  time: number
  timestamp: number
  ghost?: number[]
  strokes?: number
  poemsCleared?: number
  chainLength?: number

  constructor(data: Omit<IGameRecord, 'id' | 'timestamp'>) {
    this.gameId = data.gameId
    this.track = data.track
    this.language = data.language
    this.tier = data.tier
    this.mode = data.mode
    this.score = data.score
    this.accuracy = data.accuracy
    this.kps = data.kps
    this.maxCombo = data.maxCombo
    this.rating = data.rating
    this.time = data.time
    this.timestamp = getUTCUnixTimestamp()
    this.ghost = data.ghost
    this.strokes = data.strokes
    this.poemsCleared = data.poemsCleared
    this.chainLength = data.chainLength
  }
}
