import { useEffect, useRef, useState } from 'react';
import { ButtonGroup, IconButton, Popover, toast } from '@kivi';
import { writeClipboard } from '@kivi/hooks';
import './node-tools.css';

/*
  画布右上角的分享（照线上 layouts/canvas/components/HeaderToolbar/ShareToolbarButton.tsx）：
  一个分享图标，悬停出说明「通过链接分享画布」，点了直接复制分享链接、Toast「分享链接已复制」，图标换成对勾 2 秒。
  线上没有弹窗和权限设置，只有这一个按钮。链接是假的，不会真的能打开。
*/

const COPIED_MS = 2000;

export function ShareButton({ canvasId }: { canvasId: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const share = async () => {
    // 链接是假的：剪贴板写不进去（浏览器没给权限）也照常提示成功
    await writeClipboard(`https://kivi.example/canvas/share/${canvasId}`);
    toast.success('分享链接已复制');
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };
  return (
    <ButtonGroup variant="glass" size={44} aria-label="画布分享" className="app-share">
      <Popover
        placement="bottom-end"
        title="通过链接分享画布"
        content="任何拥有此链接的人都可以查看并克隆你的画布。"
      >
        <IconButton icon={copied ? 'CheckSmall' : 'Share'} label="分享" tooltip={false} onClick={() => void share()} />
      </Popover>
    </ButtonGroup>
  );
}
