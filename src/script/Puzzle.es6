/*
	@ author: leeenx
	@ 拼图
*/

import * as PIXI from '@pixi'
import * as filters from '@pixi-extra-filters'
import { TweenMax, TimelineLite, Linear } from '@gsap/tween-max'

// 安装模块
import './lib/utils'
import Gridistribution from './lib/Gridistribution'
import timer from './lib/timer'
import Event from './lib/Event'
PIXI.utils.skipHello()

class Puzzle {
	constructor() {
		this.width = 375
		this.height = 603

		// 事件兼容
		if(window.hasOwnProperty('ontouchstart') === true) {
			this.touchstart = 'touchstart'
			this.touchmove = 'touchmove'
			this.touchend = 'touchend'
			this.tap = 'tap'
		}
		else {
			this.touchstart = 'mousedown'
			this.touchmove = 'mousemove'
			this.touchend = 'mouseup'
			this.tap = 'click'
		}

		// 全屏适配
		let {clientWidth, clientHeight} = document.body
		let clientRatio = clientWidth / clientHeight
		// 长屏
		if(clientRatio < this.width / this.height) {
			this.height = this.width / clientRatio
		}
		// 短屏
		else {
			this.width = this.height * clientRatio
		}

		// 拼图尺寸
		this.imageWidth = 300 * .88 >> 0
		this.imageHeight = 450 * .88 >> 0
		
		// 图片与视窗的比率 
		this.imageRatio = this.imageWidth / this.width

		this.app = new PIXI.Application(
			{
				width: this.width, 
				height: this.height, 
				transparent: true, 
				view: document.getElementById('puzzleGame'), 
				antialias: true
			}
		)
		this.stage = this.app.stage
		this.renderer = this.app.renderer
		this.ticker = this.app.ticker
		this.app.view.addEventListener(this.touchstart, e => e.preventDefault())

		// 事件
		this.event = new Event()

		// 默认倒计时长
		this.totalTime = 60

		// 做挂起监听
		document.addEventListener('visibilitychange', e => {
		    e.hidden === true ? this.pause() : this.isOff !== true && this.resume()
		}, true)
	}
	get difficulty() {
		return this._difficulty
	}
	set difficulty(value) {
		if(this._difficulty !== value) {
			this._difficulty = value
			this.setDifficulty()
		}
	} 
	init() { 
		// 拼图容器
		this.puzzle = new PIXI.Container()
		this.puzzle.set(
			{
				x: this.width / 2, 
				y: this.height / 2, 
				pivotX: this.imageWidth / 2, 
				pivotY: this.imageHeight / 2 
			}
		)
		// 加入舞台
		this.stage.addChild(this.puzzle)

		// 礼花容器
		this.fireworksContainer = new PIXI.Container()

		// 拼图数组
		this.cliparts = []
		let loader = new PIXI.loaders.Loader()
		// 加载必须图片
		loader.add(
				[
					{name: 'shade', url: require('../images/shade.jpg')}, 
					{name: 'clipart', url: require('../images/clipart.png')}, 
					{name: 'pause', url: require('../images/pause@2x.png')}, 
					{name: 'play', url: require('../images/play@2x.png')}
				]
			)
			.load(() => {
				let shade = new PIXI.Sprite(PIXI.utils.TextureCache['shade'])
				shade.set(
					{
						alpha: .99, 
						width: this.width, 
						height: this.height
					}
				)
				this.stage.addChildAt(shade, 0)
				// 开关
				this.on = PIXI.utils.TextureCache['play']
				this.off = PIXI.utils.TextureCache['pause']
				this.switch.texture = this.paused === true ? this.on : this.off
				this.loaded = true
				// 生成礼花
				this.fireworks = []
				// 默认礼花
				for(let i = 0; i < 24; ++i) {
					let rect = new PIXI.Graphics()
					let rr = Math.random() * 0xFF | 0
				    let rg = Math.random() * 0xFF | 0
				    let rb = Math.random() * 0xFF | 0
				    let width = 80
				    let height = 80
				    let mask = new PIXI.Sprite(PIXI.utils.TextureCache['clipart'])
				    mask.set({width: width, height: height})
					rect.beginFill((rr << 16) + (rg << 8) + rb, 1).drawRect(0, 0, width, height)
					let sprite = new PIXI.Sprite(rect.generateCanvasTexture())
					sprite.mask = mask
					sprite.addChild(mask)
					let shell = new PIXI.Sprite(sprite.generateCanvasTexture(this.renderer))
					this.fireworks[i] = shell
				}
			})
		// 时间进度条容器
		this.timeProgressBack = new PIXI.Graphics()
		this.timeProgressBack.beginFill(0x6190e7, 1).drawRect(0, 0, this.width, 5)
		this.timeProgressFront = new PIXI.Graphics()
		this.timeProgressFront.beginFill(0x70BF41, 1).drawRect(0, 0, this.width, 5)
		this.timeProgressFront.scaleX = 0;  
		this.timeProgressBack.addChild(this.timeProgressFront)
		this.stage.addChild(this.timeProgressBack)
		// 暂停按钮
		this.switch = new PIXI.Sprite()
		this.switch.set({width: 32, height: 32, y: 6, x: this.width - 36})
		this.stage.addChild(this.switch)
		this.switch.interactive = true
		this.switch.on(this.tap, e => this.paused === true ? this.turnOn() : this.turnOff())
	}
	turnOn() {
		this.resume()
		this.switch.texture = this.off
		this.event.dispatch('resume')
		this.isOff = false
		this.renderer.render(this.stage)
	}
	turnOff() {
		this.pause()
		this.switch.texture = this.on
		this.event.dispatch('pause')
		this.isOff = true
		this.renderer.render(this.stage)
	}
	set timeProgress(value) {
		let percent = (this.totalTime - value) / this.totalTime
		this.timeProgressFront.scaleX = percent > 1 ? 1 : percent
	} 
	// 进入对应的图片
	enter(picture) {
		// 未加载成功 
		if(this.loaded !== true) { 
			setTimeout(()=> this.enter(picture, difficulty), 100)
			return 
		}
		// 销毁上次的拼块
		this.destroyCliparts()
		// 清空倒计时
		timer.delete(this.timer)
		// 重置时长 
		this.currentTime = this.totalTime
		this.timeProgressFront.scaleX = 0

		// 清空所有动画
		TweenMax.killAll()

		// 如果暂停了，恢复
		this.isOff === true && this.turnOn()

		this.showLoading()

		let afterLoad = () => {
			// 生成拼图的底层纹理 
			let originBase = new PIXI.Sprite(PIXI.utils.TextureCache[picture])
			// 重置尺寸 
			originBase.set(
				{
					width: this.imageWidth, 
					height: this.imageHeight
				}
			)
			// this.base 挂载原始图片的快照 
			this.base = originBase.generateCanvasTexture(this.renderer)
			// 拼图的底片 
			this.negative = new PIXI.Sprite(this.base)
			this.negative.set(
				{
					x: this.puzzle.x, 
					y: this.puzzle.y, 
					pivotX: this.puzzle.pivotX, 
					pivotY: this.puzzle.pivotY, 
					alpha: .2, 
					visible: false
				}
			)

			this.stage.addChildAt(this.negative, 1)
			this.clip()
			this.hideLoading()
			// 拼图收缩
			TweenMax.fromTo(
				this.puzzle, 1, 
				{
					scaleX: 1 / this.imageRatio, 
					scaleY: 1 / this.imageRatio
				}, 
				{
					scaleX: 1, 
					scaleY: 1, 
					// 拼图分散后，倒计时开始
					onComplete: ()=> this.break().then(e => this.countdown())
				}
			)
		}
		PIXI.loader.resources[picture] ? afterLoad() : PIXI.loader.add(picture).load(afterLoad)
	}

	// 设置难度
	setDifficulty() {
		// 行列数生成
		this.col = this.difficulty * 2
		this.row = this.difficulty * 3
		// 总数
		this.total = this.col * this.row
		/*
			@ 计算拼块的尺寸
			@ 原始大小: 300x300
			@ 镂空尺寸为 65
			@ (拼图宽 + 2个镂空) / 列数 = 拼块宽 - 镂空
			@ 镂空 / 拼块宽 = 65 / 300
		*/
		this.clipart = {}
		// 按照难度剪裁后的宽度 
		const width = this.imageWidth / (this.col * 235 / 300 - 65 * 2 / 300) >> 0
		const clipWidth = width * 65 / 300 >> 0
		Object.assign(
			this.clipart,
			{ width, height: width, clipWidth}
		)
	}

	// 显示加载
	showLoading() {

	}

	// 隐藏加载
	hideLoading() {

	}

	// 将图像剪裁成拼图碎片
	clip() {
		// 清空 cliparts
		this.cliparts = []
		// 清空数组
		this.cliparts = []
		let x = 0
		let y = 0
		for(let row = 0; row < this.row; ++row) { 
			x = 0
			for(let col = 0; col < this.col; ++col) { 
				let clipart = {
					index: row * this.col + col, 
					width: this.clipart.width, 
					height: this.clipart.height, 
					x: x, 
					y: y
				}
				let mask = new PIXI.Sprite(PIXI.utils.TextureCache['clipart'])
				this.stage.addChild(mask)
				mask.width = mask.height = this.clipart.width
				if(0 === row) {
					clipart.height -= this.clipart.clipWidth
					mask.y = -this.clipart.clipWidth
				}
				if(0 === col) {
					clipart.width -= this.clipart.clipWidth
					mask.x = -this.clipart.clipWidth
				}
				// 对底纹进行裁剪
				{ 
					let x = clipart.x
					let y = clipart.y
					let width = clipart.width
					let height = clipart.height
					if(x + width > this.base.width) {
						width = this.base.width - x
					}
					if(y + height > this.base.height) {
						height = this.base.height - y
					}
					// 拼块
					clipart.sprite = new PIXI.Sprite(
						new PIXI.Texture(
							this.base, 
							new PIXI.Rectangle(x, y, width, height)
						)
					)
					// 被选中的拼块
					clipart.selected = new PIXI.Sprite(clipart.sprite.texture)
				} 
				// console.log(col, row, x, y)
				this.cliparts.push(clipart)
				clipart.sprite.set(
					{
						left: x,  
						top: y, 
						mask: mask, 
						cacheAsBitmap: true 
					}
				)
				clipart.selected.set(
					{ 
						mask: mask, 
						filters: [new filters.GlowFilter(10, 1.5, 1.5, 0x333333, .3)], 
						cacheAsBitmap: true 
					}
				)
				this.puzzle.addChild(clipart.sprite)

				// 下一个拼块的 x 坐标
				x += clipart.width - this.clipart.clipWidth
				if(col === this.col - 1) { 
					// 下一行拼块的 y 坐标
					y += clipart.height - this.clipart.clipWidth
				} 
			} 
		}
	}
	// 打散拼块
	break() {
		// this.puzzle 的坐标
		let bounds = this.puzzle.getBounds()
		let [x, y] = [bounds.x, bounds.y]
		this.gridProps = {
			width: this.width, 
			height: this.height, 
			// 最小面积
			cell: {
				width: this.clipart.width * .8
			}, 
			// 标记禁区
			rectangles: [ 
				// 右上角暂停按钮
				{
					x: this.width - 36, 
					y: 0, 
					width: 36, 
					height: 36
				}, 
				// 中心拼图底图区
				{
					x: (this.width - this.imageWidth) / 2, 
					y: (this.height- this.imageHeight) / 2, 
					width: this.imageWidth, 
					height: this.imageHeight
				}
			]
		}
		let grid = new Gridistribution(this.gridProps)
		// 提取随机格子
		let cells = grid.pick(this.cliparts.length)
		let count = 0
		let width = this.gridProps.cell.width
		while(cells.length === 0 && ++count < 10) { 
			// 面积不够，取一半值
			width = width * .8
			this.gridProps.cell.width = width
			grid.reset(this.gridProps)
			cells = grid.pick(this.cliparts.length)
		}

		// 显示底片
		this.negative.visible = true

		// 手指下的拼块（multiple touch）
		let activeCliparts = []

		// 起始坐标（multiple touch）
		let startPositions = []

		// 舞台添加事件
		this.stage.interactive = true
		this.stage.on(
			this.touchmove,
			({
				data, data: { global: endPosition, identifier }
			}) => {
			const activeClipart = activeCliparts[identifier] || null
			const startPosition = startPositions[identifier] || null
			if(activeClipart !== null && startPosition !== null) { 
				if(--activeClipart.negativeCount >= 0) {
					activeClipart.rotate += activeClipart.negativeRotate
				}
				let left = activeClipart.x0 + endPosition.x - startPosition.x
				let top = activeClipart.y0 + endPosition.y - startPosition.y
				// 侧滑会导致负坐标直接调用touchend
				if(left < -this.puzzle.x) {
					touchendHandle({ data })
					return 
				}
				activeClipart.selected.set(
					{
						rotate: activeClipart.rotate, 
						left: left, 
						top: top
					}
				)
			}
		})

		let touchendHandle = ({
			data: { identifier }
		}) => {
			const activeClipart = activeCliparts[identifier] || null
			if(activeClipart === null) return 
			// 吸附效果 
			if(Math.abs(activeClipart.x - activeClipart.selected.left) <= 15 && Math.abs(activeClipart.y - activeClipart.selected.top) <= 15) {
				activeClipart.selected.rotate = 0
				activeClipart.selected.left = activeClipart.x
				activeClipart.selected.top = activeClipart.y
				// 锁定
				activeClipart.lock = true
			}
			// 初始坐标值变化
			activeClipart.x0 = activeClipart.selected.left
			activeClipart.y0 = activeClipart.selected.top

			// 正常拼块与选中拼块属性同步
			activeClipart.sprite.set(
				{
					top: activeClipart.selected.top, 
					left: activeClipart.selected.left, 
					rotate: activeClipart.selected.rotate
				}
			)

			// 当前索引
			let index = activeClipart.selected.parent.getChildIndex(activeClipart.selected)

			// 移除选中拼块
			this.puzzle.removeChild(activeClipart.selected)
			// 将拼块安装到对应位置上
			if(activeClipart.lock === true) {
				this.fit(activeClipart)
			}
			// 替换成正常拼块
			else {
				this.puzzle.addChildAt(activeClipart.sprite, index)
			} 

			// 清空对象
			delete activeCliparts[identifier]
			delete startPositions[identifier]
		}

		this.stage.on(this.touchend, touchendHandle)

		// 动画数组 
		let tweens = []
		
		// 分布
		this.cliparts.forEach((clipart, index) => { 
			// 拼块
			let sprite = clipart.sprite
			// 选中拼块
			let selected = clipart.selected
			// 开启点击检测
			sprite.interactive = true
			// 添加事件
			sprite.on(this.touchstart, ({ data: { global: position, identifier } }) => {
				// 暂停中
				if(this.paused === true) return 
				// 固定
				if(clipart.lock === true) { 
					// 禁止交互
					sprite.interactive = false
					return
				}
				let parent = sprite.parent
				// 移除当前 sprite
				parent.removeChild(sprite)
				// 最高索引值
				let maxIndex = Math.max(parent.children.length - 1, 0)
				// 替换成 selected 
				parent.addChildAt(selected, maxIndex)

				// 拼块需要摆正 
				if(selected.rotate !== 0) { 
					selected.needFitRotation = true
					let {x, y} = selected.toLocal(position)
					selected.origin = sprite.origin = [x, y]
					// origin会引起盒子位置变化，以下是修正位置
					clipart.x0 += selected.boxOffsetX
					clipart.y0 += selected.boxOffsetY
					selected.set({left: clipart.x0, top: clipart.y0})
				} 
				activeCliparts[identifier] = clipart
				startPositions[identifier] = {x: position.x, y: position.y}
			})
			clipart.rotate = (Math.random() - .5) * Math.PI / 4

			clipart.x0 = cells[index].x - x
			clipart.y0 = cells[index].y - y
			
			// 边拖边回正角度参数
			clipart.negativeCount = 10
			clipart.negativeRotate = -clipart.rotate / clipart.negativeCount

			// 拼块的属性
			let props = {
				left: clipart.x0, 
				top: clipart.y0, 
				rotate: clipart.rotate
			}

			// 拼块
			// TweenMax.to(sprite, .6, props)
			tweens.push(TweenMax.to(sprite, .3, props))
			// 选中拼块信息同步
			selected.set(props)
		})
		// 返回 Promise
		return new Promise(
			(resolve) => {
				let tl = new TimelineLite()
				tl.add(tweens, 0, 'start', .01).call(() => resolve())
			}
		)
	}
	// 安装拼块
	fit(clipart) {
		// 当前拼块索引
		let index = clipart.index
		// 左边拼块
		let leftClipart = index % this.col === 0 ? {lock: false} : this.cliparts[index - 1]
		// 右边拼块
		let rightClipart = index % this.col === this.col - 1 ? {lock: false} : this.cliparts[index + 1]
		// 上边拼块
		let upClipart = index < this.col ? {lock: false} : this.cliparts[index - this.col]
		// 下边的拼块
		let downClipart = index / this.col >> 0 === this.row - 1 ? {lock: false} : this.cliparts[index + this.col]
		// 容器
		let parent = null
		// 左拼块存在
		if(leftClipart.lock === true) { 
			parent = leftClipart.sprite.parent
		}
		// 右拼块存在
		if(rightClipart.lock === true) { 
			if(parent === null) {
				parent = rightClipart.sprite.parent
			}
			// 合并容器
			else {
				let parentB = rightClipart.sprite.parent
				if(parentB === null) console.log('报错了', rightClipart, rightClipart.sprite, rightClipart.selected)
				if(parent !== parentB) {
					let children = parentB.children
					while(children.length > 0) {
						parent.addChild(children[0])
					} 
					// 销毁
					parentB.destroy();  
				}
			}
		}
		// 上边拼块存在
		if(upClipart.lock === true) { 
			if(parent === null) {
				parent = upClipart.sprite.parent
			}
			// 合并容器
			else { 
				let parentB = upClipart.sprite.parent
				if(parentB === null) console.log('报错了',upClipart, upClipart.sprite, upClipart.selected)
				if(parent !== parentB) {
					let children = parentB.children
					while(children.length > 0) {
						parent.addChild(children[0])
					} 
					// 销毁
					parentB.destroy();  
				}
			}
		}
		// 下边拼块存在
		if(downClipart.lock === true) { 
			if(parent === null) {
				parent = downClipart.sprite.parent
			}
			// 合并容器
			else {
				let parentB = downClipart.sprite.parent
				if(parentB === null) console.log('报错了', downClipart, downClipart.sprite, downClipart.selected)
				if(parent !== parentB) {
					let children = parentB.children
					while(children.length > 0) {
						parent.addChild(children[0])
					} 
					// 销毁
					parentB.destroy();  
				}
			}
		}

		// 在一个空位置
		if(parent === null) {
			parent = new PIXI.Container()
			// 与 puzzle 容器保持一致
			parent.set(
				{
					x: this.puzzle.x, 
					y: this.puzzle.y, 
					pivotX: this.puzzle.pivotX, 
					pivotY: this.puzzle.pivotY, 
					scaleX: this.puzzle.scaleX, 
					scaleY: this.puzzle.scaleY
				}
			)
			this.stage.addChildAt(parent, 2)
		}

		// 当前拼块安装到对应的容器
		parent.addChild(clipart.sprite)

		// 容器的动画
		parent.tween && parent.tween.kill()
		parent.tween = TweenMax.fromTo(parent, .6, {alpha: .4}, {alpha: 1, ease: Linear.easeNone})

		// 判断游戏是否通关
		if(this.puzzle.children.length === 0) {
			this.pass()
		}
	}
	pass() { 
		timer.delete(this.timer)
		this.displayShell().then(e => this.event.dispatch('pass', '通关'))
	}
	// 礼花
	displayShell() { 
		this.stage.addChild(this.fireworksContainer)
		// 创建一条时间轴
		if(this.shellTimeline === undefined) {
			// 礼花随机位置
			this.gridProps.cell.width = 12
			let rnd = (new Gridistribution(this.gridProps)).pick(this.fireworks.length)
			// 时间轴数组
			let tls = rnd.map(({x, y}, index) => { 
				let shell = this.fireworks[index]
				shell.set(
					{
						scaleX: 1, 
						scaleY: 1, 
						anchorX: .5, 
						anchorY: .5,  
						top: 90, 
						left: 90
					}
				)
				this.fireworksContainer.addChild(shell)
				let tl = new TimelineLite()
				tl
					.fromTo(
						shell, .6, 
						{rotation: 0, left: x, top: y, scaleX: 0, scaleY: 0, alpha: 0}, 
						{rotation: Math.PI, scaleX: 1, scaleY: 1, alpha: .5}
					)
					.to(
						shell, 1.2, 
						{top: '+=560', left: (Math.random() > .5 ? '+' : '-')+ '=80', rotation: 0, alpha: 0}
					)
				return tl
			})
			this.shellTimeline = new TimelineLite()
			this.shellTimeline.pause()
			this.shellTimeline.add(tls, 0, 'start', 0.03)
		}
		return new Promise((resolve, reject) => {
			this.shellTimeline.restart().call(e => this.stage.removeChild(this.fireworksContainer) & resolve())
		})
	}
	// 销毁
	destroy() {
		timer.clean()
		TweenMax.killAll()
		this.destroyChildren(this.stage)
		this.stage.off(this.touchmove)
		this.stage.off(this.touchend)
		// 销毁所有的纹理
		PIXI.utils.destroyTextureCache()
		// 删除加载记录
		PIXI.loader.reset()
		this.loaded = false
		delete this.shellTimeline
	}

	// 销毁子孙元素
	destroyChildren(parent) {
		let children = parent.children
		while(children.length > 0) {
			let child = children[0]
			parent.removeChild(child)
			// 递归删除
			this.destroyChildren(child)
			child.destroy()
		}
	}

	// 销毁所有拼块
	destroyCliparts() {
		this.cliparts.forEach(clipart => {
			let {
				sprite, 
				selected, 
				sprite: {parent: parentA}, 
				selected: {parent: parentB}
			} = clipart
			sprite.destroy()
			selected.destroy()
			parentA !== null && parentA !== this.puzzle && parentA.destroy()
			parentB !== null && parentB !== this.puzzle && parentB.destroy()
		})
		this.negative && this.negative.destroy()
	}

	// 倒计时
	countdown() {
		this.timer = timer.setInterval(e => { 
			this.currentTime -= .1
			if(this.currentTime > 0) {
				this.timeProgress = this.currentTime
			}
			// 游戏结束
			else { 
				this.pause()
				timer.delete(this.timer)
				this.event.dispatch('gameover', '超时')
			}
		}, 100)
	}

	// 暂停
	pause() { 
		this.paused = true
		TweenMax.pauseAll()
		this.ticker.stop()
		timer.pause()
	}
	// 恢复
	resume() { 
		this.paused = false
		TweenMax.resumeAll()
		this.ticker.start()
		timer.resume()
	}
}

export default Puzzle
