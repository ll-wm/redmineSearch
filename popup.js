document.addEventListener('DOMContentLoaded', function() {
  const searchText = document.getElementById('search-text');
  const domSelector = document.getElementById('dom-selector');
  const parentSelector = document.getElementById('parent-selector');
  const searchBtn = document.getElementById('search-btn');
  // const clearBtn = document.getElementById('clear-btn');
  const resultsContent = document.getElementById('results-content');
  const pBox =  document.getElementById('person_box');

  document.getElementById('about-link').addEventListener('click', function() {
    // 打开options页面
    chrome.runtime.openOptionsPage();
  });

  const filedList = [
    {
      title: '指派给',
      key: 'issue_assigned_to_id',
    },
    {
      title: '开发人员',
      key: 'issue_custom_field_values_54',
    },
  ]

  var choosedField = {
    title: '指派给',
    key: 'issue_assigned_to_id',
  }

  function chooseFieldItem(e){
    choosedField = {
      title: e.target.textContent,
      key: e.target.id
    }
    
    for(let i = 0; i < domSelector.childNodes.length; i++){
      const item = domSelector.childNodes[i]
      if(item.id === e.target.id){
        item.classList.add('field-choosed')
      } else if(item.className.includes('field-choosed')){
        item.classList.remove('field-choosed')
      }
    }
  }

  filedList.map(item=>{
    
    // // 创建一个新的option元素
    // let newOption = document.createElement('option');

    // // 设置option的文本内容
    // newOption.text = item.title;

    // // 设置option的值（可选）
    // newOption.value = item.key;

    // // 将option添加到select元素中
    // domSelector.add(newOption);
    const fieldItem = document.createElement("div");
    fieldItem.className = 'dom-field-item'
    fieldItem.addEventListener('click', chooseFieldItem)
    fieldItem.textContent = item.title
    fieldItem.id = item.key
    if(item.key === choosedField.key){
      fieldItem.classList.add('field-choosed')
    }

    domSelector.appendChild(fieldItem)

  })

  let recentData = [];

  function renderPersonLi(arr){
    pBox.innerHTML = ''
    if(recentData.length){
      recentData.map(item=>{
        const cDom = document.createElement("span");
        cDom.className = 'person_btn'
        cDom.textContent = item
        cDom.addEventListener("click",()=>{
          searchText.value = item;
          searchClickFun()
        })
        pBox.appendChild(cDom)
      })
    }
  }
  // 从存储中恢复上次的搜索条件
  chrome.storage.local.get(['recentData'], function(result) {
    if(result && result.recentData) recentData = JSON.parse(result.recentData)||[]
    renderPersonLi(recentData)
    // if (result.lastSearchText) searchText.value = result.lastSearchText;
    // if (result.lastDomSelector) domSelector.value = result.lastDomSelector;
    // if (result.lastParentSelector) parentSelector.value = result.lastParentSelector;
  });

  function searchClickFun(){
    const text = searchText.value.trim();
    const selector = 'option'
    
    if (!text) {
      showMessage('请输入搜索内容', 'error');
      return;
    }
    
    if (!selector) {
      showMessage('请输入DOM选择器', 'error');
      return;
    }

    if(recentData.includes(text)) {
      let index = recentData.indexOf(text);
      recentData.splice(index, 1);
    }
    
    if(recentData.length && recentData.length > 4) recentData.pop();
    recentData.unshift(text)
    renderPersonLi(recentData)
    // 保存搜索条件
    chrome.storage.local.set({
      recentData: JSON.stringify(recentData),
    });
    
    // 显示加载状态
    showLoading();
    
    // 获取当前标签页
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const tab = tabs[0];
      
      // 执行内容脚本进行搜索
      chrome.scripting.executeScript({
        target: {tabId: tab.id},
        func: searchDOM,
        args: [text, selector, '#'+choosedField.key, choosedField.title]
      })
      .then((results) => {
        if (results && results[0] && results[0].result) {
          displayResults(results[0].result, text);
        } else {
          showMessage('搜索失败，请重试', 'error');
        }
      })
      .catch((error) => {
        console.error('执行脚本失败:', error);
        showMessage('执行脚本失败: ' + error.message, 'error');
      });
    });
  }
  
  // 搜索按钮点击事件
  searchBtn.addEventListener('click', searchClickFun);
  
  // 清空按钮点击事件
  // clearBtn.addEventListener('click', function() {
  //   searchText.value = '';
  //   resultsContent.innerHTML = '<div class="no-results">输入搜索条件并点击"搜索"按钮</div>';
  // });
  // 查找最近的滚动父容器
  function findScrollParent(element) {
    let parent = element.parentElement;
    while (parent) {
      const style = window.getComputedStyle(parent);
      const isScrollable = style.overflowY === 'auto' || style.overflowY === 'scroll' || 
                           style.overflowX === 'auto' || style.overflowX === 'scroll';
      
      if (isScrollable && parent.scrollHeight > parent.clientHeight) {
        return parent;
      }
      
      parent = parent.parentElement;
    }
    
    return document.scrollingElement || document.documentElement;
  }
  
  // 在DOM中搜索内容的函数
  function searchDOM(searchText, selector, parentSelector, fieldName) {
    try {
      // 确定搜索范围
      const rootElement = parentSelector ? 
        document.querySelector(parentSelector) : document.body;
      
      if (!rootElement) {
        return { error: '未找到指定的父容器' };
      }
      
      // 查找所有匹配选择器的元素
      const elements = rootElement.querySelectorAll(selector);
      const results = [];
      
      // 遍历元素，查找包含搜索文本的节点
      elements.forEach(element => {
        let textContent = element.textContent || '';
        textContent = textContent.replaceAll(" ", "")
        if(element.parentNode.label === 'Author / Previous assignee') return;
        if (textContent.includes(searchText)) {
          // 生成唯一标识符
          const uniqueId = 'dom-search-' + Math.random().toString(36).substr(2, 9);
          element.setAttribute('data-dom-search-id', uniqueId);
          
          // 查找最近的滚动父容器
          const scrollParent = rootElement;
          
          results.push({
            text: textContent.trim(),
            elementId: uniqueId,
            scrollParentId: scrollParent ? scrollParent.id || null : null,
            elementValue: element.value,
            fieldName
          });
        }
      });
      return { results };
    } catch (error) {
      return { error: error.message };
    }
  }
  
  
  // 显示加载状态
  function showLoading() {
    resultsContent.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>正在搜索...
      </div>
    `;
  }
  
  // 显示消息
  function showMessage(message, type = 'info') {
    const className = type === 'error' ? 'no-results error' : 'no-results';
    resultsContent.innerHTML = `<div class="${className}">${message}</div>`;
  }
  
  // 显示搜索结果
  function displayResults(data, searchText) {
    if (data.error) {
      showMessage('搜索出错: ' + data.error, 'error');
      return;
    }
    
    const results = data.results;
    
    if (results.length === 0) {
      showMessage('未找到匹配的内容');
      return;
    }
    
    // 创建结果列表
    const list = document.createElement('ul');
    list.className = 'results-list';
    
    results.forEach((result, index) => {
      const listItem = document.createElement('li');
      listItem.className = 'result-item';
      listItem.dataset.index = index;
      
      // 高亮显示搜索文本
      const highlightedText = result.text.replace(
        new RegExp(escapeRegExp(searchText), 'gi'), 
        match => `<span class="highlight">${match}</span>`
      );
      
      listItem.innerHTML = `
        <div style="margin-bottom: 4px;">${highlightedText}</div>
        <div style="font-size: 12px; color: #7f8c8d;">
          ${result.scrollParentId ? `父容器: ${result.scrollParentId}` : '页面级别'}
        </div>
      `;
      
      // 点击结果项时滚动到对应位置
      listItem.addEventListener('click', function() {
        if(result.scrollParentId !== 'issue_custom_field_values_54'){
          setSelectValue({fieldId: result.scrollParentId, fieldValue: result.elementValue, fieldName: result.fieldName, name: result.text})
        } else {
          const resultIndex = parseInt(this.dataset.index);
          scrollToResult(results[resultIndex]);
        }
        
      });
      
      list.appendChild(listItem);
    });
    
    resultsContent.innerHTML = '';
    resultsContent.appendChild(list);
    
    // 显示结果统计
    const header = document.querySelector('.results-header');
    header.textContent = `搜索结果 (${results.length} 个匹配项，点击修改字段数据)`;
  }
  
  // 滚动到搜索结果位置
  function scrollToResult(result) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        func: scrollToElement,
        args: [result.elementId, result.scrollParentId, result.fieldName, result.text]
      })
      .catch((error) => {
        console.error('滚动失败:', error);
      });
    });
  }

  // 滚动到搜索结果位置
  function setSelectValue(result) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        func: setFieldValue,
        args: [result.fieldId, result.fieldValue, result.fieldName, result.name]
      })
      .catch((error) => {
        console.error('滚动失败:', error);
      });
    });
  }

  function setFieldValue(parentId, value, fieldName, name){
    if(!window.popupMessage) {
      window.popupMessage = {
        // 创建消息容器
        getMessageContainer: function() {
            let container = document.getElementById('ant-message-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'ant-message-container';
                container.className = 'ant-message';
                document.body.appendChild(container);
            }
            return container;
        },
        
        // 显示消息
        show: function(config) {
            const { type, content, duration = 3000, onClose } = config;
            const container = this.getMessageContainer();
            
            // 创建消息元素
            const notice = document.createElement('div');
            notice.className = `ant-message-notice ant-message-${type}`;
            
            const noticeContent = document.createElement('div');
            noticeContent.className = 'ant-message-notice-content';
            
            // 图标
            const iconMap = {
                success: chrome.runtime.getURL('images/success.svg'),
                error: chrome.runtime.getURL('images/error.svg'),
                warning: chrome.runtime.getURL('images/warn.svg'),
                info: chrome.runtime.getURL('images/info.svg')
            };
            
            noticeContent.innerHTML = `<img src="${iconMap[type]}" alt="SVG Image"><span>${content}</span>`;
            notice.appendChild(noticeContent);
            container.appendChild(notice);
            
            // 自动关闭
            let timer = null;
            if (duration > 0) {
                timer = setTimeout(() => {
                    this.close(notice, onClose);
                }, duration);
            }
            
            // 返回关闭函数
            return () => {
                if (timer) clearTimeout(timer);
                this.close(notice, onClose);
            };
        },
        
        // 关闭消息
        close: function(notice, onClose) {
            if (!notice || !notice.parentNode) return;
            
            notice.classList.add('ant-message-notice-leave');
            
            setTimeout(() => {
                if (notice.parentNode) {
                    notice.parentNode.removeChild(notice);
                }
                if (onClose) onClose();
            }, 300);
        },
        
        // 成功消息
        success: function(content, duration, onClose) {
            return this.show({ type: 'success', content, duration, onClose });
        },
        
        // 错误消息
        error: function(content, duration, onClose) {
            return this.show({ type: 'error', content, duration, onClose });
        },
        
        // 警告消息
        warning: function(content, duration, onClose) {
            return this.show({ type: 'warning', content, duration, onClose });
        },
        
        // 信息消息
        info: function(content, duration, onClose) {
            return this.show({ type: 'info', content, duration, onClose });
        },
        
        // 销毁所有消息
        destroy: function() {
            const container = this.getMessageContainer();
            if (container && container.parentNode) {
                container.parentNode.removeChild(container);
            }
        }
      };
      const oldLink = document.getElementById('messageCSS')
      if(oldLink) {
        oldLink.parentNode.removeChild(oldLink)
      }
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = chrome.runtime.getURL('message.css');
      link.id = 'messageCSS'
      document.head.appendChild(link);
    }
    const parentDom = document.getElementById(parentId);
    parentDom.value = value;
    window.popupMessage.success(`已将${fieldName}改为${name}`)
  }
  
  // 在页面中滚动到指定元素的函数
  function scrollToElement(elementId, scrollParentId, fieldName, name) {
    const element = document.querySelector(`[data-dom-search-id="${elementId}"]`);
    if (element) {
      // 高亮显示元素
      // const originalBackground = element.style.backgroundColor;
      // element.style.backgroundColor = '#fff3cd';
      // element.style.transition = 'background-color 0.5s';
      
      // 确定滚动容器
      let scrollContainer = document.scrollingElement || document.documentElement;
      if (scrollParentId) {
        const parent = document.getElementById(scrollParentId);
        if (parent) scrollContainer = parent;
      }
      
      // 计算元素在滚动容器中的位置
      const elementRect = element.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();
      
      // 计算滚动位置
      const scrollTop = elementRect.top - containerRect.top + scrollContainer.scrollTop - (containerRect.height / 2 - elementRect.height / 2);
      
      // 执行滚动
      scrollContainer.scrollTo({
        top: scrollTop,
        behavior: 'smooth'
      });
      if(!window.popupMessage) {
        window.popupMessage = {
          // 创建消息容器
          getMessageContainer: function() {
              let container = document.getElementById('ant-message-container');
              if (!container) {
                  container = document.createElement('div');
                  container.id = 'ant-message-container';
                  container.className = 'ant-message';
                  document.body.appendChild(container);
              }
              return container;
          },
          
          // 显示消息
          show: function(config) {
              const { type, content, duration = 3000, onClose } = config;
              const container = this.getMessageContainer();
              
              // 创建消息元素
              const notice = document.createElement('div');
              notice.className = `ant-message-notice ant-message-${type}`;
              
              const noticeContent = document.createElement('div');
              noticeContent.className = 'ant-message-notice-content';
              
              const iconMap = {
                success: chrome.runtime.getURL('images/success.svg'),
                error: chrome.runtime.getURL('images/error.svg'),
                warning: chrome.runtime.getURL('images/warn.svg'),
                info: chrome.runtime.getURL('images/info.svg')
              };
              
              noticeContent.innerHTML = `<img src="${iconMap[type]}" alt="SVG Image"><span>${content}</span>`;
              notice.appendChild(noticeContent);
              container.appendChild(notice);
              
              // 自动关闭
              let timer = null;
              if (duration > 0) {
                  timer = setTimeout(() => {
                      this.close(notice, onClose);
                  }, duration);
              }
              
              // 返回关闭函数
              return () => {
                  if (timer) clearTimeout(timer);
                  this.close(notice, onClose);
              };
          },
          
          // 关闭消息
          close: function(notice, onClose) {
              if (!notice || !notice.parentNode) return;
              
              notice.classList.add('ant-message-notice-leave');
              
              setTimeout(() => {
                  if (notice.parentNode) {
                      notice.parentNode.removeChild(notice);
                  }
                  if (onClose) onClose();
              }, 300);
          },
          
          // 成功消息
          success: function(content, duration, onClose) {
              return this.show({ type: 'success', content, duration, onClose });
          },
          
          // 错误消息
          error: function(content, duration, onClose) {
              return this.show({ type: 'error', content, duration, onClose });
          },
          
          // 警告消息
          warning: function(content, duration, onClose) {
              return this.show({ type: 'warning', content, duration, onClose });
          },
          
          // 信息消息
          info: function(content, duration, onClose) {
              return this.show({ type: 'info', content, duration, onClose });
          },
          
          // 加载消息
          loading: function(content, duration, onClose) {
              return this.show({ type: 'loading', content, duration, onClose });
          },
          
          // 销毁所有消息
          destroy: function() {
              const container = this.getMessageContainer();
              if (container && container.parentNode) {
                  container.parentNode.removeChild(container);
              }
          }
        };
        const oldLink = document.getElementById('messageCSS')
        if(oldLink) {
          oldLink.parentNode.removeChild(oldLink)
        }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = chrome.runtime.getURL('message.css');
        link.id = 'messageCSS'
        document.head.appendChild(link);
      }
      const parent = document.getElementById(scrollParentId);
      parent.value = element.value
      window.popupMessage.success(`已将${fieldName}改为${name}`)
      // 3秒后恢复原始背景色
      // setTimeout(() => {
      //   element.style.backgroundColor = originalBackground;
      // }, 3000);
    }
  }
  
  // 转义正则表达式特殊字符
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
});