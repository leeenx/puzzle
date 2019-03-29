import Puzzle from './Puzzle'

import '../css/puzzle.css'

// 关卡信息
const levels = [
  {
    // 大图
    picture: require('../images/pictures/a.jpg'), 
    // 小图
    thumb: require('../images/covers/a.jpg'), 
    // 描述
    instr: "秋天的银杏树", 
    // 免费
    free: true
  }, 
  {
    // 大图
    picture: require('../images/pictures/b.jpg'), 
    // 小图
    thumb: require('../images/covers/b.jpg'), 
    // 描述
    instr: "毕加索的画 ---- 少女", 
    // 免费
    free: true
  }, 
  {
    // 大图
    picture: require('../images/pictures/c.jpg'), 
    // 小图
    thumb: require('../images/covers/c.jpg'), 
    // 描述
    instr: "毕加索的画 ---- 树", 
    // 免费
    free: true
  }, 
  {
    // 大图
    picture: require('../images/pictures/d.jpg'), 
    // 小图
    thumb: require('../images/covers/d.jpg'), 
    // 描述
    instr: "毕加索的画 ---- 桥", 
    // 免费
    free: true
  }, 
  {
    // 大图
    picture: require('../images/pictures/e.jpg'), 
    // 小图
    thumb: require('../images/covers/e.jpg'), 
    // 描述
    instr: "不知道哪里来的美女", 
    // 免费
    free: false
  }
]

// 从 localStorage 中读取记录
const record = JSON.parse(localStorage.getItem("puzzle-record")) || {level: -1, difficulty: 2}
// 初始化列表
puzzleList.innerHTML = levels.map(
  (level, index) =>
    `
      <li
        onclick="this.className === \'puzzle_lock\' || selectLevel(${index})"
        ${record.level < index && level.free !== true ? 'class="puzzle_lock"' : ''}
      >
        <span class="puzzle_map_thumb">
          <img src="${level.thumb}">
        </span>
        <span class="puzzle_map_instr">
          ${level.instr}<br>
          <b>${level.free === true ? '免费' : '解锁可玩'}</b>
        </span>
      </li>
    `
).join("\n")

const puzzleLevel = puzzleList.querySelectorAll("li")

// 显示地图 
global.showPuzzleMap = function() {
  puzzleMap.className = "puzzle_map show"
}
// 隐藏地图
global.hidePuzzleMap = function() {
  puzzleMap.className = "puzzle_map";  
}

// 选择关卡
global.selectLevel = function(index) { 
  puzzleGame.className = "puzzle_game show"
  setTimeout(function() {
    puzzle.enter(levels[index].picture)
    record.level = index
    updateRecord()
  }, 600)
}

// 返回
global.back = function() {
  puzzleAd.style.display = "none"
  puzzleGame.className = "puzzle_game"
}

// 更新记录
const updateRecord = function() {
  localStorage.setItem("puzzle-record", JSON.stringify(record))
}

// 设置难度
const setDifficulty = function(difficulty) { 
  difficulty = difficulty | 0
  difficulty = difficulty > 1 ? difficulty : 1
  difficultyOpts[difficulty - 1].checked = "checked"
  puzzle.difficulty = difficulty
  puzzle.totalTime = difficulty * 120
}

// 创建拼图对象
const puzzle = new Puzzle()

// 默认进入第一张图
puzzle.init()
// 设置倒计时
puzzle.totalTime = 60

// 通关
puzzle.event.on("pass", function() { 
  if(record.level < levels.length - 1) { 
    // 解锁
    puzzleLevel[++record.level].className = ""
    puzzle.enter(levels[record.level].picture)
    updateRecord();  
  }
  else {
    alert("游戏结束")
  }
})

// 游戏结束
puzzle.event.on("gameover", function() {
  alert("超时了")
})

// 暂停显示广告
puzzle.event.on("pause", function() {
  puzzleAd.style.display = "block"
})

// 恢复隐藏广告
puzzle.event.on("resume", function() {
  puzzleAd.style.display = "none"
})

// 难度选项
const difficultyOpts = document.querySelectorAll(".puzzle_difficulty")
difficultyOpts.forEach(function(opt) {
  opt.addEventListener("click", function() {
    record.difficulty = this.value
    puzzle.difficulty = this.value
    updateRecord()
  })
})

// 同步游戏难度
setDifficulty(record.difficulty)

// 玩过 
if(record.level >= 0) {
  resumeGame.className = "puzzle_btn"
  resumeGame.onclick = function() {
    selectLevel(record.level)
  }
}
// 没玩过
else {
  resumeGame.className = "puzzle_btn disabled"
} 

global.puzzle = puzzle
